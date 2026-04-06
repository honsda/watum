import type { Connection } from 'mysql2/promise';

export type InsertLecturerParams = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
}

export type InsertLecturerResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertLecturer(connection: Connection, params: InsertLecturerParams): Promise<InsertLecturerResult> {
    const sql = `
    INSERT INTO lecturers (id, name, email, phone, address)
    VALUES (?, ?, ?, ?, ?)
    `

    return connection.query(sql, [params.id, params.name, params.email, params.phone, params.address])
        .then(res => res[0] as InsertLecturerResult);
}