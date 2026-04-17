import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { verify } from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { getPool } from './db';
import { selectUsers } from './sql';

const SESSION_COOKIE_NAME = 'session_token';
const LEGACY_SESSION_COOKIE_NAME = 'session_id';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
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

type SelectUserRow = Awaited<ReturnType<typeof selectUsers>>[number];

function mapUser(user: SelectUserRow): User {
	return {
		id: user.id!,
		email: user.email!,
		role: user.role!,
		studentId: user.student_id ?? null,
		lecturerId: user.lecturer_id ?? null,
		student: user.student_id ? { id: user.student_id, name: user.student_name! } : null,
		lecturer: user.lecturer_id ? { id: user.lecturer_id, name: user.lecturer_name! } : null
	};
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

function getBaseSessionCookieOptions(url: URL) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:'
	};
}

async function signSessionToken(userId: string) {
	let jwt = new SignJWT({})
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(userId)
		.setIssuedAt()
		.setExpirationTime(`${SESSION_MAX_AGE}s`);

	const issuer = getJwtIssuer();
	if (issuer) {
		jwt = jwt.setIssuer(issuer);
	}

	return jwt.sign(getJwtSecret());
}

async function verifySessionToken(token: string) {
	try {
		const issuer = getJwtIssuer();
		const { payload } = await jwtVerify(token, getJwtSecret(), issuer ? { issuer } : undefined);

		return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
	} catch {
		return null;
	}
}

function deleteSessionCookies() {
	const { cookies, url } = getRequestEvent();
	const options = getBaseSessionCookieOptions(url);

	cookies.delete(SESSION_COOKIE_NAME, options);
	cookies.delete(LEGACY_SESSION_COOKIE_NAME, options);
}

export async function getUser(): Promise<User | null> {
	const { cookies } = getRequestEvent();
	const sessionToken = cookies.get(SESSION_COOKIE_NAME);
	if (!sessionToken) {
		return null;
	}

	const userId = await verifySessionToken(sessionToken);
	if (!userId) {
		deleteSessionCookies();
		return null;
	}

	const [user] = await selectUsers(getPool(), {
		where: [['id', '=', userId]]
	});
	if (!user) {
		deleteSessionCookies();
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

export async function setSession(userId: string) {
	const { cookies, url } = getRequestEvent();
	const sessionToken = await signSessionToken(userId);

	cookies.set(SESSION_COOKIE_NAME, sessionToken, {
		...getBaseSessionCookieOptions(url),
		maxAge: SESSION_MAX_AGE
	});
	cookies.delete(LEGACY_SESSION_COOKIE_NAME, getBaseSessionCookieOptions(url));
}

export function clearSession() {
	deleteSessionCookies();
}

export async function login(email: string, password: string): Promise<User> {
	const [user] = await selectUsers(getPool(), { where: [['email', '=', email]] });
	if (!user) {
		throw error(401, 'Email atau password salah');
	}
	const valid = await verify(user.password!, password);
	if (!valid) {
		throw error(401, 'Email atau password salah');
	}
	return mapUser(user);
}
