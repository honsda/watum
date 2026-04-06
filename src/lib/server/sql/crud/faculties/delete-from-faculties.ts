import type { Connection } from 'mysql2/promise';

export type DeleteFromFacultiesParams = {
    id: string;
}

export type DeleteFromFacultiesResult = {
    affectedRows: number;
}

export async function deleteFromFaculties(connection: Connection, params: DeleteFromFacultiesParams): Promise<DeleteFromFacultiesResult> {
    const sql = `
    DELETE FROM faculties
    WHERE \`id\` = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteFromFacultiesResult);
}