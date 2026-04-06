import type { Connection } from 'mysql2/promise';

export type UpdateClassRoomData = {
    name: string;
    class_room_type: 'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM';
    capacity: number;
    has_projector?: number;
    has_ac?: number;
}

export type UpdateClassRoomParams = {
    id: string;
}

export type UpdateClassRoomResult = {
    affectedRows: number;
}

export async function updateClassRoom(connection: Connection, data: UpdateClassRoomData, params: UpdateClassRoomParams): Promise<UpdateClassRoomResult> {
    const sql = `
    UPDATE class_rooms
    SET
        name = ?,
        class_room_type = ?,
        capacity = ?,
        has_projector = ?,
        has_ac = ?
    WHERE class_rooms.id = ?
    `

    return connection.query(sql, [data.name, data.class_room_type, data.capacity, data.has_projector, data.has_ac, params.id])
        .then(res => res[0] as UpdateClassRoomResult);
}