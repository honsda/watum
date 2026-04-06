import type { Connection } from 'mysql2/promise';

export type DeleteLectuerParams = {
    id: string;
}

export type DeleteLectuerResult = {
    affectedRows: number;
}

export async function deleteLectuer(connection: Connection, params: DeleteLectuerParams): Promise<DeleteLectuerResult> {
    const sql = `
    DELETE FROM lecturers WHERE id = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteLectuerResult);
}