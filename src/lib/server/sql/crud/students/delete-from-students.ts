import type { Connection } from 'mysql2/promise';

export type DeleteFromStudentsParams = {
    id: string;
}

export type DeleteFromStudentsResult = {
    affectedRows: number;
}

export async function deleteFromStudents(connection: Connection, params: DeleteFromStudentsParams): Promise<DeleteFromStudentsResult> {
    const sql = `
    DELETE FROM students
    WHERE \`id\` = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteFromStudentsResult);
}