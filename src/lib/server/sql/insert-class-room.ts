import type { Connection } from 'mysql2/promise';

export type InsertClassRoomParams = {
    id: string;
    name: string;
    class_room_type: 'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM';
    capacity: number;
    has_projector?: number;
    has_ac?: number;
}

export type InsertClassRoomResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertClassRoom(connection: Connection, params: InsertClassRoomParams): Promise<InsertClassRoomResult> {
    const sql = `
    INSERT INTO class_rooms (id, name, class_room_type, capacity, has_projector, has_ac)
    VALUES (?, ?, ?, ?, ?, ?)
    `

    return connection.query(sql, [params.id, params.name, params.class_room_type, params.capacity, params.has_projector, params.has_ac])
        .then(res => res[0] as InsertClassRoomResult);
}