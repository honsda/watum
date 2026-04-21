import type { Connection } from 'mysql2/promise';

export type UpdateUserData = {
	email: string;
	password?: string;
	role: 'ADMIN' | 'STUDENT' | 'LECTURER';
	student_id?: string | null;
	lecturer_id?: string | null;
};

export type UpdateUserParams = {
	id: string;
};

export type UpdateUserResult = {
	affectedRows: number;
};

export async function updateUser(
	connection: Connection,
	data: UpdateUserData,
	params: UpdateUserParams
): Promise<UpdateUserResult> {
	const sql = `
    UPDATE users
    SET email = ?, password = CASE WHEN ? IS NULL THEN password ELSE ? END, role = ?, student_id = ?, lecturer_id = ?
    WHERE id = ?
    `;

	return connection
		.query(sql, [
			data.email,
			data.password ?? null,
			data.password ?? null,
			data.role,
			data.student_id ?? null,
			data.lecturer_id ?? null,
			params.id
		])
		.then((res) => res[0] as UpdateUserResult);
}
