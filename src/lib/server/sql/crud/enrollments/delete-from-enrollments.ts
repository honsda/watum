import type { Connection } from 'mysql2/promise';

export type DeleteFromEnrollmentsParams = {
    id: string;
}

export type DeleteFromEnrollmentsResult = {
    affectedRows: number;
}

export async function deleteFromEnrollments(connection: Connection, params: DeleteFromEnrollmentsParams): Promise<DeleteFromEnrollmentsResult> {
    const sql = `
    DELETE FROM enrollments
    WHERE \`id\` = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteFromEnrollmentsResult);
}