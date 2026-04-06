import { getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { verify } from 'argon2';
import { getPool } from './db';
import { selectUsers } from './sql';
import type { Return } from '@prisma/client/runtime/client';

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

export async function getUser(): Promise<User | null> {
	const { cookies } = getRequestEvent();
	const sessionId = cookies.get('session_id');
	if (!sessionId) {
		return null;
	}

	const [user] = await selectUsers(getPool(), {
		where: [['id', '=', sessionId]]
	});
	if (!user) {
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

export async function login( email: string, password: string): Promise<User> {
	const [user] = await selectUsers(getPool(), { where: [['email', '=', email]]})
	if (!user) {
		throw error(401, 'Email atau password salah');
	}
	const valid = await verify(user.password!, password);
	if (!valid) {
		throw error(401, 'Email atau password salah');
	}
	return mapUser(user);
}