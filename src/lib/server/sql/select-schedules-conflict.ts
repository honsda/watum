import type { Connection } from 'mysql2/promise';

export type SelectSchedulesConflictParams = {
    classRoomId: string;
    day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
    startTime: Date | string;
    endTime: Date | string;
    semester?: string;
    academicYear?: string;
    excludeScheduleId?: string;
}

export type SelectSchedulesConflictResult = {
    id: string;
    start_time: string;
    end_time: string;
}

export async function selectSchedulesConflict(connection: Connection, params: SelectSchedulesConflictParams): Promise<SelectSchedulesConflictResult[]> {
    let sql = `
    SELECT id, start_time, end_time FROM schedules
    WHERE class_room_id = ? AND day = ?
    AND start_time < ? AND end_time > ?
    `
    const values: unknown[] = [params.classRoomId, params.day, params.endTime, params.startTime];

    if (params.semester || params.academicYear) {
        sql += ` AND id IN (
            SELECT e.schedule_id
            FROM enrollments e
            WHERE 1 = 1`;
        if (params.semester) {
            sql += ` AND e.semester = ?`;
            values.push(params.semester);
        }
        if (params.academicYear) {
            sql += ` AND e.academic_year = ?`;
            values.push(params.academicYear);
        }
        sql += `)`;
    }

    if (params.excludeScheduleId) {
        sql += ` AND id <> ?`;
        values.push(params.excludeScheduleId);
    }

    sql += ` ORDER BY start_time ASC`;

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
