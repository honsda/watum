import type { Connection } from 'mysql2/promise';

export type SelectSchedulesConflictParams = {
    classRoomId: string;
    day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
    startTime: Date;
    endTime: Date;
    excludeScheduleId?: string;
}

export type SelectSchedulesConflictResult = {
    id: string;
    start_time: Date;
    end_time: Date;
}

export async function selectSchedulesConflict(connection: Connection, params: SelectSchedulesConflictParams): Promise<SelectSchedulesConflictResult[]> {
    let sql = `
    SELECT id, start_time, end_time FROM schedules
    WHERE class_room_id = ? AND day = ?
    AND TIME(start_time) < TIME(?) AND TIME(end_time) > TIME(?)
    `
    const values: unknown[] = [params.classRoomId, params.day, params.endTime, params.startTime];

    if (params.excludeScheduleId) {
        sql += ` AND id <> ?`;
        values.push(params.excludeScheduleId);
    }

    sql += ` ORDER BY TIME(start_time) ASC`;

    return connection.query({sql, rowsAsArray: true}, values)
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectSchedulesConflictResult(data)));
}

function mapArrayToSelectSchedulesConflictResult(data: any) {
    const result: SelectSchedulesConflictResult = {
        id: data[0],
        start_time: data[1],
        end_time: data[2]
    }
    return result;
}
