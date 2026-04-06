import type { Connection } from 'mysql2/promise';

export type InsertFacultyParams = {
    id: string;
    name: string;
}

export type InsertFacultyResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertFaculty(connection: Connection, params: InsertFacultyParams): Promise<InsertFacultyResult> {
    const sql = `
    INSERT INTO faculties (id, name)
    VALUES (?, ?)
    `

    return connection.query(sql, [params.id, params.name])
        .then(res => res[0] as InsertFacultyResult);
}