import type { Connection } from 'mysql2/promise';

export type DeleteFacultyParams = {
    id: string;
}

export type DeleteFacultyResult = {
    affectedRows: number;
}

export async function deleteFaculty(connection: Connection, params: DeleteFacultyParams): Promise<DeleteFacultyResult> {
    const sql = `
    DELETE FROM faculties WHERE id = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteFacultyResult);
}