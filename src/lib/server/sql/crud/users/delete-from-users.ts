import type { Connection } from 'mysql2/promise';

export type DeleteFromUsersParams = {
    id: string;
}

export type DeleteFromUsersResult = {
    affectedRows: number;
}

export async function deleteFromUsers(connection: Connection, params: DeleteFromUsersParams): Promise<DeleteFromUsersResult> {
    const sql = `
    DELETE FROM users
    WHERE \`id\` = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteFromUsersResult);
}