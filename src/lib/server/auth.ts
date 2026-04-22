import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { verify } from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from './db';
import { getConnection, getPool, retryRead, withTransaction } from './db';
import { selectUsers } from './sql';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 5;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const ACCESS_CONTEXT_BINDING_CLAIM = 'ctx';
const PASSWORD_VERSION_CLAIM = 'pwdv';
const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
const SECURE_REFRESH_TOKEN_COOKIE_NAME = `__Secure-${REFRESH_TOKEN_COOKIE_NAME}`;
const LEGACY_HOST_REFRESH_TOKEN_COOKIE_NAME = `__Host-${REFRESH_TOKEN_COOKIE_NAME}`;
const REFRESH_TOKEN_COOKIE_PATH = '/auth';
const LEGACY_SESSION_COOKIE_NAMES = [
	'session_token',
	'__Host-session_token',
	'session_id'
] as const;
const textEncoder = new TextEncoder();

interface User {
	id: string;
	email: string;
	role: 'ADMIN' | 'STUDENT' | 'LECTURER';
	studentId: string | null;
	lecturerId: string | null;
	student: { id: string; name: string } | null;
	lecturer: { id: string; name: string } | null;
}

interface AccessTokenPayload {
	userId: string;
	contextBinding: string;
	passwordVersion: string;
}

interface RefreshTokenRow extends RowDataPacket {
	id: string;
	user_id: string;
	token_hash: string;
	context_binding: string;
	expires_at: Date | string;
}

interface AuthenticatedLoginResult {
	user: User;
	passwordHash: string;
}

type SelectUserRow = Awaited<ReturnType<typeof selectUsers>>[number];

function mapUser(user: SelectUserRow): User {
	return {
		id: user.id!,
		email: user.email!,
		role: user.role!,
		studentId: user.student_id ?? null,
		lecturerId: user.lecturer_id ?? null,
		student: user.student_id ? { id: user.student_id, name: user.student_name ?? '' } : null,
		lecturer: user.lecturer_id ? { id: user.lecturer_id, name: user.lecturer_name ?? '' } : null
	};
}

function hashValue(value: string) {
	return createHash('sha256').update(value).digest('base64url');
}

function hashRefreshToken(token: string) {
	return hashValue(`refresh:${token}`);
}

function createOpaqueToken() {
	return randomBytes(48).toString('base64url');
}

function getPasswordVersion(passwordHash: string) {
	return hashValue(passwordHash);
}

function getRequestContextBinding() {
	const { request } = getRequestEvent();
	const userAgent = request.headers.get('user-agent') ?? '';
	const acceptLanguage = request.headers.get('accept-language') ?? '';
	const secChUa = request.headers.get('sec-ch-ua') ?? '';
	const secChUaPlatform = request.headers.get('sec-ch-ua-platform') ?? '';
	const secChUaMobile = request.headers.get('sec-ch-ua-mobile') ?? '';

	return hashValue(
		['access-context-v1', userAgent, acceptLanguage, secChUa, secChUaPlatform, secChUaMobile].join(
			'\n'
		)
	);
}

function getJwtSecret() {
	if (!env.JWT_SECRET) {
		throw new Error('JWT_SECRET is not configured');
	}

	return textEncoder.encode(env.JWT_SECRET);
}

function getJwtIssuer() {
	return env.JWT_ISSUER || undefined;
}

function useSecureCookies(url: URL) {
	return url.protocol === 'https:' || env.NODE_ENV === 'production';
}

function getPreferredRefreshTokenCookieName(url: URL) {
	return useSecureCookies(url) ? SECURE_REFRESH_TOKEN_COOKIE_NAME : REFRESH_TOKEN_COOKIE_NAME;
}

function getRefreshTokenCookieNames(url: URL) {
	const preferred = getPreferredRefreshTokenCookieName(url);
	return [
		...new Set([
			preferred,
			REFRESH_TOKEN_COOKIE_NAME,
			SECURE_REFRESH_TOKEN_COOKIE_NAME,
			LEGACY_HOST_REFRESH_TOKEN_COOKIE_NAME
		])
	];
}

function getRefreshTokenCookieOptions(url: URL) {
	return {
		path: REFRESH_TOKEN_COOKIE_PATH,
		httpOnly: true,
		sameSite: 'strict' as const,
		secure: useSecureCookies(url)
	};
}

function getLegacySessionCookieOptions(url: URL) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: useSecureCookies(url)
	};
}

function getAccessTokenFromRequest() {
	const authorization = getRequestEvent().request.headers.get('authorization');
	if (!authorization) {
		return null;
	}

	const [scheme, token] = authorization.split(' ');
	if (scheme !== 'Bearer' || !token) {
		return null;
	}

	return token;
}

function getRefreshTokenFromCookies() {
	const { cookies, url } = getRequestEvent();
	for (const cookieName of getRefreshTokenCookieNames(url)) {
		const token = cookies.get(cookieName);
		if (token) {
			return token;
		}
	}

	return null;
}

function clearLegacySessionCookies() {
	const { cookies, url } = getRequestEvent();
	const options = getLegacySessionCookieOptions(url);
	for (const cookieName of LEGACY_SESSION_COOKIE_NAMES) {
		cookies.delete(cookieName, options);
	}
}

function setRefreshTokenCookie(token: string) {
	const { cookies, url } = getRequestEvent();
	const preferredCookieName = getPreferredRefreshTokenCookieName(url);
	const options = {
		...getRefreshTokenCookieOptions(url),
		maxAge: REFRESH_TOKEN_TTL_SECONDS
	};

	cookies.set(preferredCookieName, token, options);
	for (const cookieName of getRefreshTokenCookieNames(url)) {
		if (cookieName !== preferredCookieName) {
			cookies.delete(cookieName, getRefreshTokenCookieOptions(url));
		}
	}
	clearLegacySessionCookies();
}

function clearRefreshTokenCookies() {
	const { cookies, url } = getRequestEvent();
	for (const cookieName of getRefreshTokenCookieNames(url)) {
		cookies.delete(cookieName, getRefreshTokenCookieOptions(url));
	}
	clearLegacySessionCookies();
}

function isRefreshTokenExpired(expiresAt: Date | string) {
	const timestamp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
	return Number.isNaN(timestamp.getTime()) || timestamp.getTime() <= Date.now();
}

async function signAccessToken(userId: string, passwordHash: string) {
	let jwt = new SignJWT({
		[ACCESS_CONTEXT_BINDING_CLAIM]: getRequestContextBinding(),
		[PASSWORD_VERSION_CLAIM]: getPasswordVersion(passwordHash)
	})
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(userId)
		.setIssuedAt()
		.setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`);

	const issuer = getJwtIssuer();
	if (issuer) {
		jwt = jwt.setIssuer(issuer);
	}

	return jwt.sign(getJwtSecret());
}

async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
	try {
		const issuer = getJwtIssuer();
		const { payload } = await jwtVerify(token, getJwtSecret(), issuer ? { issuer } : undefined);
		const contextBinding = payload[ACCESS_CONTEXT_BINDING_CLAIM];
		const passwordVersion = payload[PASSWORD_VERSION_CLAIM];

		if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
			return null;
		}

		if (typeof contextBinding !== 'string' || contextBinding.length === 0) {
			return null;
		}

		if (typeof passwordVersion !== 'string' || passwordVersion.length === 0) {
			return null;
		}

		return {
			userId: payload.sub,
			contextBinding,
			passwordVersion
		};
	} catch {
		return null;
	}
}

async function insertRefreshToken(
	connection: PoolConnection,
	userId: string,
	tokenHash: string,
	contextBinding: string,
	expiresAt: Date
) {
	await connection.query(
		`INSERT INTO refresh_tokens (id, user_id, token_hash, context_binding, expires_at)
		 VALUES (?, ?, ?, ?, ?)`,
		[randomUUID(), userId, tokenHash, contextBinding, expiresAt]
	);
}

async function selectUserById(
	connection: PoolConnection | ReturnType<typeof getPool>,
	userId: string
) {
	const [user] = await selectUsers(connection as PoolConnection, {
		where: [['id', '=', userId]]
	});
	return user ?? null;
}

export async function getUser(): Promise<User | null> {
	const accessToken = getAccessTokenFromRequest();
	if (!accessToken) {
		return null;
	}

	const session = await verifyAccessToken(accessToken);
	if (!session) {
		return null;
	}

	if (session.contextBinding !== getRequestContextBinding()) {
		return null;
	}

	const [user] = await retryRead(() =>
		selectUsers(getPool(), {
			where: [['id', '=', session.userId]]
		})
	);
	if (!user || !user.password || getPasswordVersion(user.password) !== session.passwordVersion) {
		return null;
	}

	return mapUser(user);
}

export async function requireUser(): Promise<User> {
	const user = await getUser();
	if (!user) {
		error(401, 'Unauthorized');
	}
	return user;
}

export async function requireRole(roles: Array<User['role']>): Promise<User> {
	const user = await requireUser();
	if (!roles.includes(user.role)) {
		error(403, 'Forbidden');
	}
	return user;
}

export async function setSession(
	userId: string,
	passwordHash: string
): Promise<{ accessToken: string }> {
	const refreshToken = createOpaqueToken();
	const refreshTokenHash = hashRefreshToken(refreshToken);
	const contextBinding = getRequestContextBinding();
	const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

	await withTransaction(async (connection) => {
		await connection.query('DELETE FROM refresh_tokens WHERE user_id = ? AND context_binding = ?', [
			userId,
			contextBinding
		]);
		await insertRefreshToken(connection, userId, refreshTokenHash, contextBinding, expiresAt);
	});

	setRefreshTokenCookie(refreshToken);

	return {
		accessToken: await signAccessToken(userId, passwordHash)
	};
}

export async function refreshSession(): Promise<{ accessToken: string; user: User } | null> {
	const refreshToken = getRefreshTokenFromCookies();
	if (!refreshToken) {
		clearRefreshTokenCookies();
		return null;
	}

	const refreshTokenHash = hashRefreshToken(refreshToken);
	const contextBinding = getRequestContextBinding();

	const result = await withTransaction(async (connection) => {
		const [rows] = await connection.query<RefreshTokenRow[]>(
			`SELECT id, user_id, token_hash, context_binding, expires_at
			 FROM refresh_tokens
			 WHERE token_hash = ?
			 LIMIT 1
			 FOR UPDATE`,
			[refreshTokenHash]
		);

		const refreshTokenRow = rows[0];
		if (!refreshTokenRow) {
			return null;
		}

		if (
			refreshTokenRow.context_binding !== contextBinding ||
			isRefreshTokenExpired(refreshTokenRow.expires_at)
		) {
			await connection.query('DELETE FROM refresh_tokens WHERE id = ?', [refreshTokenRow.id]);
			return null;
		}

		const user = await selectUserById(connection, refreshTokenRow.user_id);
		if (!user?.password) {
			await connection.query('DELETE FROM refresh_tokens WHERE id = ?', [refreshTokenRow.id]);
			return null;
		}

		await connection.query('DELETE FROM refresh_tokens WHERE id = ?', [refreshTokenRow.id]);

		const nextRefreshToken = createOpaqueToken();
		const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken);
		const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
		await insertRefreshToken(
			connection,
			refreshTokenRow.user_id,
			nextRefreshTokenHash,
			contextBinding,
			expiresAt
		);

		return {
			accessToken: await signAccessToken(refreshTokenRow.user_id, user.password),
			refreshToken: nextRefreshToken,
			user: mapUser(user)
		};
	});

	if (!result) {
		clearRefreshTokenCookies();
		return null;
	}

	setRefreshTokenCookie(result.refreshToken);
	return {
		accessToken: result.accessToken,
		user: result.user
	};
}

export async function clearSession() {
	const refreshToken = getRefreshTokenFromCookies();
	if (refreshToken) {
		await getPool().query<ResultSetHeader>('DELETE FROM refresh_tokens WHERE token_hash = ?', [
			hashRefreshToken(refreshToken)
		]);
	}

	clearRefreshTokenCookies();
}

export async function revokeRefreshTokensForUser(userId: string) {
	await getPool().query<ResultSetHeader>('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
}

export async function login(email: string, password: string): Promise<AuthenticatedLoginResult> {
	const [user] = await retryRead(() =>
		selectUsers(getPool(), {
			select: {
				id: true,
				email: true,
				role: true,
				password: true,
				student_id: true,
				lecturer_id: true
			},
			where: [['email', '=', email]]
		})
	);
	if (!user?.password) {
		throw error(401, 'Email atau password salah');
	}
	const valid = await verify(user.password, password);
	if (!valid) {
		throw error(401, 'Email atau password salah');
	}
	return {
		user: mapUser(user),
		passwordHash: user.password
	};
}

export async function loginAndSetSession(
	email: string,
	password: string
): Promise<{ user: User; accessToken: string }> {
	const connection = await getConnection();

	try {
		const [user] = await selectUsers(connection, {
			select: {
				id: true,
				email: true,
				role: true,
				password: true,
				student_id: true,
				lecturer_id: true
			},
			where: [['email', '=', email]]
		});

		if (!user?.id || !user.password) {
			throw error(401, 'Email atau password salah');
		}

		const valid = await verify(user.password, password);
		if (!valid) {
			throw error(401, 'Email atau password salah');
		}

		const refreshToken = createOpaqueToken();
		const refreshTokenHash = hashRefreshToken(refreshToken);
		const contextBinding = getRequestContextBinding();
		const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

		await connection.beginTransaction();
		try {
			await connection.query(
				'DELETE FROM refresh_tokens WHERE user_id = ? AND context_binding = ?',
				[user.id, contextBinding]
			);
			await insertRefreshToken(connection, user.id, refreshTokenHash, contextBinding, expiresAt);
			await connection.commit();
		} catch (err) {
			await connection.rollback();
			throw err;
		}

		setRefreshTokenCookie(refreshToken);

		return {
			user: mapUser(user),
			accessToken: await signAccessToken(user.id, user.password)
		};
	} finally {
		connection.release();
	}
}
