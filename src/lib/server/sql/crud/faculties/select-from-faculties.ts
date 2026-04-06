import type { Connection } from 'mysql2/promise';

export type SelectFromFacultiesParams = {
    id: string;
}

export type SelectFromFacultiesResult = {
    id: string;
    name: string;
    created_at?: Date;
    updated_at?: Date;
}

export async function selectFromFaculties(connection: Connection, params: SelectFromFacultiesParams): Promise<SelectFromFacultiesResult | null> {
    const sql = `
    SELECT
        \`id\`,
        \`name\`,
        \`created_at\`,
        \`updated_at\`
    FROM faculties
    WHERE \`id\` = ?
    `

    return connection.query({sql, rowsAsArray: true}, [params.id])
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectFromFacultiesResult(data)))
        .then(res => res[0]);
}

function mapArrayToSelectFromFacultiesResult(data: any) {
    const result: SelectFromFacultiesResult = {
        id: data[0],
        name: data[1],
        created_at: data[2],
        updated_at: data[3]
    }
    return result;
}