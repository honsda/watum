import type { Connection } from 'mysql2/promise';

export type SelectSchedulesConflictParams = {
    classRoomId: string;
    day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
    startTime: Date;
    endTime: Date;
}

export type SelectSchedulesConflictResult = {
    id: string;
    start_time: Date;
    end_time: Date;
}

export async function selectSchedulesConflict(connection: Connection, params: SelectSchedulesConflictParams): Promise<SelectSchedulesConflictResult[]> {
    const sql = `
    SELECT id, start_time, end_time FROM schedules
    WHERE class_room_id =? AND day = ?
    AND ((start_time < ? AND end_time > ?)
    OR (start_time < ? AND end_time > ?))
    `

    return connection.query({sql, rowsAsArray: true}, [params.classRoomId, params.day, params.startTime, params.startTime, params.endTime, params.endTime])
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