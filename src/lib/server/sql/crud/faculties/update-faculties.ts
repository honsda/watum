import type { Connection } from 'mysql2/promise';

export type UpdateFacultiesData = {
    id?: string;
    name?: string;
    created_at?: Date | null;
    updated_at?: Date | null;
}

export type UpdateFacultiesParams = {
    id: string;
}

export type UpdateFacultiesResult = {
    affectedRows: number;
}

export async function updateFaculties(connection: Connection, data: UpdateFacultiesData, params: UpdateFacultiesParams): Promise<UpdateFacultiesResult> {
    const sql = `
    UPDATE faculties
    SET
        \`id\` = CASE WHEN ? THEN ? ELSE \`id\` END,
        \`name\` = CASE WHEN ? THEN ? ELSE \`name\` END,
        \`created_at\` = CASE WHEN ? THEN ? ELSE \`created_at\` END,
        \`updated_at\` = CASE WHEN ? THEN ? ELSE \`updated_at\` END
    WHERE
        \`id\` = ?
    `

    return connection.query(sql, [data.id !== undefined, data.id, data.name !== undefined, data.name, data.created_at !== undefined, data.created_at, data.updated_at !== undefined, data.updated_at, params.id])
        .then(res => res[0] as UpdateFacultiesResult);
}