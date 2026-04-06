import type { Connection } from 'mysql2/promise';

export type UpdateUsersData = {
    id?: string;
    email?: string;
    password?: string;
    role?: 'ADMIN' | 'STUDENT' | 'LECTURER';
    student_id?: string | null;
    lecturer_id?: string | null;
    created_at?: Date | null;
    updated_at?: Date | null;
}

export type UpdateUsersParams = {
    id: string;
}

export type UpdateUsersResult = {
    affectedRows: number;
}

export async function updateUsers(connection: Connection, data: UpdateUsersData, params: UpdateUsersParams): Promise<UpdateUsersResult> {
    const sql = `
    UPDATE users
    SET
        \`id\` = CASE WHEN ? THEN ? ELSE \`id\` END,
        \`email\` = CASE WHEN ? THEN ? ELSE \`email\` END,
        \`password\` = CASE WHEN ? THEN ? ELSE \`password\` END,
        \`role\` = CASE WHEN ? THEN ? ELSE \`role\` END,
        \`student_id\` = CASE WHEN ? THEN ? ELSE \`student_id\` END,
        \`lecturer_id\` = CASE WHEN ? THEN ? ELSE \`lecturer_id\` END,
        \`created_at\` = CASE WHEN ? THEN ? ELSE \`created_at\` END,
        \`updated_at\` = CASE WHEN ? THEN ? ELSE \`updated_at\` END
    WHERE
        \`id\` = ?
    `

    return connection.query(sql, [data.id !== undefined, data.id, data.email !== undefined, data.email, data.password !== undefined, data.password, data.role !== undefined, data.role, data.student_id !== undefined, data.student_id, data.lecturer_id !== undefined, data.lecturer_id, data.created_at !== undefined, data.created_at, data.updated_at !== undefined, data.updated_at, params.id])
        .then(res => res[0] as UpdateUsersResult);
}