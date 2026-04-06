import type { Connection } from 'mysql2/promise';

export type DeleteUserParams = {
    id: string;
}

export type DeleteUserResult = {
    affectedRows: number;
}

export async function deleteUser(connection: Connection, params: DeleteUserParams): Promise<DeleteUserResult> {
    const sql = `
    DELETE FROM users WHERE id = ?
    
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteUserResult);
}