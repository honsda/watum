import type { Connection } from 'mysql2/promise';

export type UpdateLecturerData = {
    name: string;
    email: string;
    phone?: string;
    address?: string;
}

export type UpdateLecturerParams = {
    id: string;
}

export type UpdateLecturerResult = {
    affectedRows: number;
}

export async function updateLecturer(connection: Connection, data: UpdateLecturerData, params: UpdateLecturerParams): Promise<UpdateLecturerResult> {
    const sql = `
    UPDATE lecturers
    SET name = ?,
        email = ?,
        phone = ?,
        address = ?
    WHERE id = ?
    `

    return connection.query(sql, [data.name, data.email, data.phone, data.address, params.id])
        .then(res => res[0] as UpdateLecturerResult);
}