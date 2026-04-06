import type { Connection } from 'mysql2/promise';

export type InsertIntoFacultiesParams = {
    id: string;
    name: string;
    created_at?: Date;
    updated_at?: Date;
}

export type InsertIntoFacultiesResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertIntoFaculties(connection: Connection, params: InsertIntoFacultiesParams): Promise<InsertIntoFacultiesResult> {
    const sql = `
    INSERT INTO faculties
    (
        \`id\`,
        \`name\`,
        \`created_at\`,
        \`updated_at\`
    )
    VALUES
    (
        ?,
        ?,
        ?,
        ?
    )
    `

    return connection.query(sql, [params.id, params.name, params.created_at, params.updated_at])
        .then(res => res[0] as InsertIntoFacultiesResult);
}