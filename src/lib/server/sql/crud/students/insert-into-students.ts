import type { Connection } from 'mysql2/promise';

export type InsertIntoStudentsParams = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    year_admitted: number;
    study_program_id: string;
    created_at?: Date;
    updated_at?: Date;
}

export type InsertIntoStudentsResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertIntoStudents(connection: Connection, params: InsertIntoStudentsParams): Promise<InsertIntoStudentsResult> {
    const sql = `
    INSERT INTO students
    (
        \`id\`,
        \`name\`,
        \`email\`,
        \`phone\`,
        \`address\`,
        \`year_admitted\`,
        \`study_program_id\`,
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
        ?,
        ?
    )
    `

    return connection.query(sql, [params.id, params.name, params.email, params.phone, params.address, params.year_admitted, params.study_program_id, params.created_at, params.updated_at])
        .then(res => res[0] as InsertIntoStudentsResult);
}