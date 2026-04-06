import type { Connection } from 'mysql2/promise';

export type InsertIntoSchedulesParams = {
    id: string;
    class_room_id: string;
    day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
    start_time: Date;
    end_time: Date;
    lecturer_id?: string;
    created_at?: Date;
    updated_at?: Date;
}

export type InsertIntoSchedulesResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertIntoSchedules(connection: Connection, params: InsertIntoSchedulesParams): Promise<InsertIntoSchedulesResult> {
    const sql = `
    INSERT INTO schedules
    (
        \`id\`,
        \`class_room_id\`,
        \`day\`,
        \`start_time\`,
        \`end_time\`,
        \`lecturer_id\`,
        \`created_at\`,
        \`updated_at\`
    )
    VALUES
    (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
    )
    `

    return connection.query(sql, [params.id, params.class_room_id, params.day, params.start_time, params.end_time, params.lecturer_id, params.created_at, params.updated_at])
        .then(res => res[0] as InsertIntoSchedulesResult);
}