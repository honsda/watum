import type { Connection } from 'mysql2/promise';

export type InsertIntoLecturersParams = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    created_at?: Date;
    updated_at?: Date;
}

export type InsertIntoLecturersResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertIntoLecturers(connection: Connection, params: InsertIntoLecturersParams): Promise<InsertIntoLecturersResult> {
    const sql = `
    INSERT INTO lecturers
    (
        \`id\`,
        \`name\`,
        \`email\`,
        \`phone\`,
        \`address\`,
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
        ?
    )
    `

    return connection.query(sql, [params.id, params.name, params.email, params.phone, params.address, params.created_at, params.updated_at])
        .then(res => res[0] as InsertIntoLecturersResult);
}