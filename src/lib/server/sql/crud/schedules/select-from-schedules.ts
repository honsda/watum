import type { Connection } from 'mysql2/promise';

export type SelectFromSchedulesParams = {
    id: string;
}

export type SelectFromSchedulesResult = {
    id: string;
    class_room_id: string;
    day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
    start_time: Date;
    end_time: Date;
    lecturer_id?: string;
    created_at?: Date;
    updated_at?: Date;
}

export async function selectFromSchedules(connection: Connection, params: SelectFromSchedulesParams): Promise<SelectFromSchedulesResult | null> {
    const sql = `
    SELECT
        \`id\`,
        \`class_room_id\`,
        \`day\`,
        \`start_time\`,
        \`end_time\`,
        \`lecturer_id\`,
        \`created_at\`,
        \`updated_at\`
    FROM schedules
    WHERE \`id\` = ?
    `

    return connection.query({sql, rowsAsArray: true}, [params.id])
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectFromSchedulesResult(data)))
        .then(res => res[0]);
}

function mapArrayToSelectFromSchedulesResult(data: any) {
    const result: SelectFromSchedulesResult = {
        id: data[0],
        class_room_id: data[1],
        day: data[2],
        start_time: data[3],
        end_time: data[4],
        lecturer_id: data[5],
        created_at: data[6],
        updated_at: data[7]
    }
    return result;
}