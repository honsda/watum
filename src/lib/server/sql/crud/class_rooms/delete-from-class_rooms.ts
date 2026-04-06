import type { Connection } from 'mysql2/promise';

export type DeleteFromClassRoomsParams = {
    id: string;
}

export type DeleteFromClassRoomsResult = {
    affectedRows: number;
}

export async function deleteFromClassRooms(connection: Connection, params: DeleteFromClassRoomsParams): Promise<DeleteFromClassRoomsResult> {
    const sql = `
    DELETE FROM class_rooms
    WHERE \`id\` = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteFromClassRoomsResult);
}