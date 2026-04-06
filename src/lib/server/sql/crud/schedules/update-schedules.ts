import type { Connection } from 'mysql2/promise';

export type UpdateSchedulesData = {
    id?: string;
    class_room_id?: string;
    day?: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
    start_time?: Date;
    end_time?: Date;
    lecturer_id?: string | null;
    created_at?: Date | null;
    updated_at?: Date | null;
}

export type UpdateSchedulesParams = {
    id: string;
}

export type UpdateSchedulesResult = {
    affectedRows: number;
}

export async function updateSchedules(connection: Connection, data: UpdateSchedulesData, params: UpdateSchedulesParams): Promise<UpdateSchedulesResult> {
    const sql = `
    UPDATE schedules
    SET
        \`id\` = CASE WHEN ? THEN ? ELSE \`id\` END,
        \`class_room_id\` = CASE WHEN ? THEN ? ELSE \`class_room_id\` END,
        \`day\` = CASE WHEN ? THEN ? ELSE \`day\` END,
        \`start_time\` = CASE WHEN ? THEN ? ELSE \`start_time\` END,
        \`end_time\` = CASE WHEN ? THEN ? ELSE \`end_time\` END,
        \`lecturer_id\` = CASE WHEN ? THEN ? ELSE \`lecturer_id\` END,
        \`created_at\` = CASE WHEN ? THEN ? ELSE \`created_at\` END,
        \`updated_at\` = CASE WHEN ? THEN ? ELSE \`updated_at\` END
    WHERE
        \`id\` = ?
    `

    return connection.query(sql, [data.id !== undefined, data.id, data.class_room_id !== undefined, data.class_room_id, data.day !== undefined, data.day, data.start_time !== undefined, data.start_time, data.end_time !== undefined, data.end_time, data.lecturer_id !== undefined, data.lecturer_id, data.created_at !== undefined, data.created_at, data.updated_at !== undefined, data.updated_at, params.id])
        .then(res => res[0] as UpdateSchedulesResult);
}