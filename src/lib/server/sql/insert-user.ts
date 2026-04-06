import type { Connection } from 'mysql2/promise';

export type InsertUserParams = {
    id: string;
    email: string;
    password: string;
    role: 'ADMIN' | 'STUDENT' | 'LECTURER';
    student_id?: string;
    lecturer_id?: string;
}

export type InsertUserResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertUser(connection: Connection, params: InsertUserParams): Promise<InsertUserResult> {
    const sql = `
    INSERT INTO users (id, email, password, role, student_id, lecturer_id)
    VALUES (?, ?, ?, ?, ?, ?)
    
    `

    return connection.query(sql, [params.id, params.email, params.password, params.role, params.student_id, params.lecturer_id])
        .then(res => res[0] as InsertUserResult);
}