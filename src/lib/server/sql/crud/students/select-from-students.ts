import type { Connection } from 'mysql2/promise';

export type SelectFromStudentsParams = {
    id: string;
}

export type SelectFromStudentsResult = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    year_admitted: number;
    study_program_id: string;
    created_at?: Date;
    updated_at?: Date;
}

export async function selectFromStudents(connection: Connection, params: SelectFromStudentsParams): Promise<SelectFromStudentsResult | null> {
    const sql = `
    SELECT
        \`id\`,
        \`name\`,
        \`email\`,
        \`phone\`,
        \`address\`,
        \`year_admitted\`,
        \`study_program_id\`,
        \`created_at\`,
        \`updated_at\`
    FROM students
    WHERE \`id\` = ?
    `

    return connection.query({sql, rowsAsArray: true}, [params.id])
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectFromStudentsResult(data)))
        .then(res => res[0]);
}

function mapArrayToSelectFromStudentsResult(data: any) {
    const result: SelectFromStudentsResult = {
        id: data[0],
        name: data[1],
        email: data[2],
        phone: data[3],
        address: data[4],
        year_admitted: data[5],
        study_program_id: data[6],
        created_at: data[7],
        updated_at: data[8]
    }
    return result;
}