import type { Connection } from 'mysql2/promise';

export type InsertScheduleParams = {
    id: string;
    class_room_id: string;
    day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
    start_time: Date | string;
    end_time: Date | string;
    lecturer_id?: string;
}

export type InsertScheduleResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertSchedule(connection: Connection, params: InsertScheduleParams): Promise<InsertScheduleResult> {
    const sql = `
    INSERT INTO schedules (id, class_room_id, day, start_time, end_time, lecturer_id)
    VALUES (?, ?, ?, ?, ?, ?)
    `

    return connection.query(sql, [params.id, params.class_room_id, params.day, params.start_time, params.end_time, params.lecturer_id])
        .then(res => res[0] as InsertScheduleResult);
}