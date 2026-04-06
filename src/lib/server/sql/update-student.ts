import type { Connection } from 'mysql2/promise';

export type UpdateStudentData = {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    year_admitted: number;
    study_program_id: string;
}

export type UpdateStudentParams = {
    id: string;
}

export type UpdateStudentResult = {
    affectedRows: number;
}

export async function updateStudent(connection: Connection, data: UpdateStudentData, params: UpdateStudentParams): Promise<UpdateStudentResult> {
    const sql = `
    UPDATE students 
    SET name = ?,
        email = ?,
        phone = ?,
        address = ?,
        year_admitted = ?,
        study_program_id = ?
    WHERE id = ?
    `

    return connection.query(sql, [data.name, data.email, data.phone, data.address, data.year_admitted, data.study_program_id, params.id])
        .then(res => res[0] as UpdateStudentResult);
}