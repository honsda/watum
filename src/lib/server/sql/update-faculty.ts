import type { Connection } from 'mysql2/promise';

export type UpdateFacultyData = {
    name: string;
}

export type UpdateFacultyParams = {
    id: string;
}

export type UpdateFacultyResult = {
    affectedRows: number;
}

export async function updateFaculty(connection: Connection, data: UpdateFacultyData, params: UpdateFacultyParams): Promise<UpdateFacultyResult> {
    const sql = `
    UPDATE faculties
    SET name = ?
    WHERE id = ?
    `

    return connection.query(sql, [data.name, params.id])
        .then(res => res[0] as UpdateFacultyResult);
}