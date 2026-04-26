import type { Connection } from 'mysql2/promise';

export type UpdateScheduleData = {
    class_room_id: string;
    day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
    start_time: Date | string;
    end_time: Date | string;
    lecturer_id?: string;
}

export type UpdateScheduleParams = {
    id: string;
}

export type UpdateScheduleResult = {
    affectedRows: number;
}

export async function updateSchedule(connection: Connection, data: UpdateScheduleData, params: UpdateScheduleParams): Promise<UpdateScheduleResult> {
    const sql = `
    UPDATE schedules
    SET class_room_id = ?, day = ?, start_time = ?,
        end_time = ?, lecturer_id = ?
    WHERE id = ?
    `

    return connection.query(sql, [data.class_room_id, data.day, data.start_time, data.end_time, data.lecturer_id, params.id])
        .then(res => res[0] as UpdateScheduleResult);
}