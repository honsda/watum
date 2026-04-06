import type { Connection } from 'mysql2/promise';

export type DeleteClassRoomParams = {
    id: string;
}

export type DeleteClassRoomResult = {
    affectedRows: number;
}

export async function deleteClassRoom(connection: Connection, params: DeleteClassRoomParams): Promise<DeleteClassRoomResult> {
    const sql = `
    DELETE FROM class_rooms WHERE id = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteClassRoomResult);
}