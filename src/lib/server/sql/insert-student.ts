import type { Connection } from 'mysql2/promise';

export type InsertStudentParams = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    year_admitted: number;
    study_program_id: string;
}

export type InsertStudentResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertStudent(connection: Connection, params: InsertStudentParams): Promise<InsertStudentResult> {
    const sql = `
    INSERT INTO students (id, name, email, phone, address, year_admitted, study_program_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `

    return connection.query(sql, [params.id, params.name, params.email, params.phone, params.address, params.year_admitted, params.study_program_id])
        .then(res => res[0] as InsertStudentResult);
}