import type { Connection } from 'mysql2/promise';

export type DeleteScheduleParams = {
    id: string;
}

export type DeleteScheduleResult = {
    affectedRows: number;
}

export async function deleteSchedule(connection: Connection, params: DeleteScheduleParams): Promise<DeleteScheduleResult> {
    const sql = `
    DELETE FROM schedules WHERE id = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteScheduleResult);
}