import type { Connection } from 'mysql2/promise';

export type DeleteFromLecturersParams = {
    id: string;
}

export type DeleteFromLecturersResult = {
    affectedRows: number;
}

export async function deleteFromLecturers(connection: Connection, params: DeleteFromLecturersParams): Promise<DeleteFromLecturersResult> {
    const sql = `
    DELETE FROM lecturers
    WHERE \`id\` = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteFromLecturersResult);
}