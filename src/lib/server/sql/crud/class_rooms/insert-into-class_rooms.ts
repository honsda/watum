import type { Connection } from 'mysql2/promise';

export type InsertIntoClassRoomsParams = {
    id: string;
    name: string;
    class_room_type: 'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM';
    capacity: number;
    has_projector?: number;
    has_ac?: number;
    created_at?: Date;
    updated_at?: Date;
}

export type InsertIntoClassRoomsResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertIntoClassRooms(connection: Connection, params: InsertIntoClassRoomsParams): Promise<InsertIntoClassRoomsResult> {
    const sql = `
    INSERT INTO class_rooms
    (
        \`id\`,
        \`name\`,
        \`class_room_type\`,
        \`capacity\`,
        \`has_projector\`,
        \`has_ac\`,
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

    return connection.query(sql, [params.id, params.name, params.class_room_type, params.capacity, params.has_projector, params.has_ac, params.created_at, params.updated_at])
        .then(res => res[0] as InsertIntoClassRoomsResult);
}