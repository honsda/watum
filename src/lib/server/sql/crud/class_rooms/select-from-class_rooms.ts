import type { Connection } from 'mysql2/promise';

export type SelectFromClassRoomsParams = {
    id: string;
}

export type SelectFromClassRoomsResult = {
    id: string;
    name: string;
    class_room_type: 'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM';
    capacity: number;
    has_projector?: number;
    has_ac?: number;
    created_at?: Date;
    updated_at?: Date;
}

export async function selectFromClassRooms(connection: Connection, params: SelectFromClassRoomsParams): Promise<SelectFromClassRoomsResult | null> {
    const sql = `
    SELECT
        \`id\`,
        \`name\`,
        \`class_room_type\`,
        \`capacity\`,
        \`has_projector\`,
        \`has_ac\`,
        \`created_at\`,
        \`updated_at\`
    FROM class_rooms
    WHERE \`id\` = ?
    `

    return connection.query({sql, rowsAsArray: true}, [params.id])
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectFromClassRoomsResult(data)))
        .then(res => res[0]);
}

function mapArrayToSelectFromClassRoomsResult(data: any) {
    const result: SelectFromClassRoomsResult = {
        id: data[0],
        name: data[1],
        class_room_type: data[2],
        capacity: data[3],
        has_projector: data[4],
        has_ac: data[5],
        created_at: data[6],
        updated_at: data[7]
    }
    return result;
}