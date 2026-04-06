import type { Connection } from 'mysql2/promise';

export type InsertIntoUsersParams = {
    id: string;
    email: string;
    password: string;
    role: 'ADMIN' | 'STUDENT' | 'LECTURER';
    student_id?: string;
    lecturer_id?: string;
    created_at?: Date;
    updated_at?: Date;
}

export type InsertIntoUsersResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertIntoUsers(connection: Connection, params: InsertIntoUsersParams): Promise<InsertIntoUsersResult> {
    const sql = `
    INSERT INTO users
    (
        \`id\`,
        \`email\`,
        \`password\`,
        \`role\`,
        \`student_id\`,
        \`lecturer_id\`,
        \`created_at\`,
        \`updated_at\`
    )
    VALUES
    (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
    )
    `

    return connection.query(sql, [params.id, params.email, params.password, params.role, params.student_id, params.lecturer_id, params.created_at, params.updated_at])
        .then(res => res[0] as InsertIntoUsersResult);
}