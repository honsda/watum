import type { Connection } from 'mysql2/promise';

export type UpdateClassRoomsData = {
    id?: string;
    name?: string;
    class_room_type?: 'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM';
    capacity?: number;
    has_projector?: number | null;
    has_ac?: number | null;
    created_at?: Date | null;
    updated_at?: Date | null;
}

export type UpdateClassRoomsParams = {
    id: string;
}

export type UpdateClassRoomsResult = {
    affectedRows: number;
}

export async function updateClassRooms(connection: Connection, data: UpdateClassRoomsData, params: UpdateClassRoomsParams): Promise<UpdateClassRoomsResult> {
    const sql = `
    UPDATE class_rooms
    SET
        \`id\` = CASE WHEN ? THEN ? ELSE \`id\` END,
        \`name\` = CASE WHEN ? THEN ? ELSE \`name\` END,
        \`class_room_type\` = CASE WHEN ? THEN ? ELSE \`class_room_type\` END,
        \`capacity\` = CASE WHEN ? THEN ? ELSE \`capacity\` END,
        \`has_projector\` = CASE WHEN ? THEN ? ELSE \`has_projector\` END,
        \`has_ac\` = CASE WHEN ? THEN ? ELSE \`has_ac\` END,
        \`created_at\` = CASE WHEN ? THEN ? ELSE \`created_at\` END,
        \`updated_at\` = CASE WHEN ? THEN ? ELSE \`updated_at\` END
    WHERE
        \`id\` = ?
    `

    return connection.query(sql, [data.id !== undefined, data.id, data.name !== undefined, data.name, data.class_room_type !== undefined, data.class_room_type, data.capacity !== undefined, data.capacity, data.has_projector !== undefined, data.has_projector, data.has_ac !== undefined, data.has_ac, data.created_at !== undefined, data.created_at, data.updated_at !== undefined, data.updated_at, params.id])
        .then(res => res[0] as UpdateClassRoomsResult);
}