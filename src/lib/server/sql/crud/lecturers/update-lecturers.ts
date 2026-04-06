import type { Connection } from 'mysql2/promise';

export type UpdateLecturersData = {
    id?: string;
    name?: string;
    email?: string;
    phone?: string | null;
    address?: string | null;
    created_at?: Date | null;
    updated_at?: Date | null;
}

export type UpdateLecturersParams = {
    id: string;
}

export type UpdateLecturersResult = {
    affectedRows: number;
}

export async function updateLecturers(connection: Connection, data: UpdateLecturersData, params: UpdateLecturersParams): Promise<UpdateLecturersResult> {
    const sql = `
    UPDATE lecturers
    SET
        \`id\` = CASE WHEN ? THEN ? ELSE \`id\` END,
        \`name\` = CASE WHEN ? THEN ? ELSE \`name\` END,
        \`email\` = CASE WHEN ? THEN ? ELSE \`email\` END,
        \`phone\` = CASE WHEN ? THEN ? ELSE \`phone\` END,
        \`address\` = CASE WHEN ? THEN ? ELSE \`address\` END,
        \`created_at\` = CASE WHEN ? THEN ? ELSE \`created_at\` END,
        \`updated_at\` = CASE WHEN ? THEN ? ELSE \`updated_at\` END
    WHERE
        \`id\` = ?
    `

    return connection.query(sql, [data.id !== undefined, data.id, data.name !== undefined, data.name, data.email !== undefined, data.email, data.phone !== undefined, data.phone, data.address !== undefined, data.address, data.created_at !== undefined, data.created_at, data.updated_at !== undefined, data.updated_at, params.id])
        .then(res => res[0] as UpdateLecturersResult);
}