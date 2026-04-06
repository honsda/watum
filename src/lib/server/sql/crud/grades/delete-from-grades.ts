import type { Connection } from 'mysql2/promise';

export type DeleteFromGradesParams = {
    id: string;
}

export type DeleteFromGradesResult = {
    affectedRows: number;
}

export async function deleteFromGrades(connection: Connection, params: DeleteFromGradesParams): Promise<DeleteFromGradesResult> {
    const sql = `
    DELETE FROM grades
    WHERE \`id\` = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteFromGradesResult);
}