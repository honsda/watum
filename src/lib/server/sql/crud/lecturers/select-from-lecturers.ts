import type { Connection } from 'mysql2/promise';

export type SelectFromLecturersParams = {
    id: string;
}

export type SelectFromLecturersResult = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    created_at?: Date;
    updated_at?: Date;
}

export async function selectFromLecturers(connection: Connection, params: SelectFromLecturersParams): Promise<SelectFromLecturersResult | null> {
    const sql = `
    SELECT
        \`id\`,
        \`name\`,
        \`email\`,
        \`phone\`,
        \`address\`,
        \`created_at\`,
        \`updated_at\`
    FROM lecturers
    WHERE \`id\` = ?
    `

    return connection.query({sql, rowsAsArray: true}, [params.id])
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectFromLecturersResult(data)))
        .then(res => res[0]);
}

function mapArrayToSelectFromLecturersResult(data: any) {
    const result: SelectFromLecturersResult = {
        id: data[0],
        name: data[1],
        email: data[2],
        phone: data[3],
        address: data[4],
        created_at: data[5],
        updated_at: data[6]
    }
    return result;
}