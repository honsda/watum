import type { Connection } from 'mysql2/promise';

export type DeleteFromSchedulesParams = {
    id: string;
}

export type DeleteFromSchedulesResult = {
    affectedRows: number;
}

export async function deleteFromSchedules(connection: Connection, params: DeleteFromSchedulesParams): Promise<DeleteFromSchedulesResult> {
    const sql = `
    DELETE FROM schedules
    WHERE \`id\` = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteFromSchedulesResult);
}