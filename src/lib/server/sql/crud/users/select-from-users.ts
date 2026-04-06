import type { Connection } from 'mysql2/promise';

export type SelectFromUsersParams = {
    id: string;
}

export type SelectFromUsersResult = {
    id: string;
    email: string;
    password: string;
    role: 'ADMIN' | 'STUDENT' | 'LECTURER';
    student_id?: string;
    lecturer_id?: string;
    created_at?: Date;
    updated_at?: Date;
}

export async function selectFromUsers(connection: Connection, params: SelectFromUsersParams): Promise<SelectFromUsersResult | null> {
    const sql = `
    SELECT
        \`id\`,
        \`email\`,
        \`password\`,
        \`role\`,
        \`student_id\`,
        \`lecturer_id\`,
        \`created_at\`,
        \`updated_at\`
    FROM users
    WHERE \`id\` = ?
    `

    return connection.query({sql, rowsAsArray: true}, [params.id])
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectFromUsersResult(data)))
        .then(res => res[0]);
}

function mapArrayToSelectFromUsersResult(data: any) {
    const result: SelectFromUsersResult = {
        id: data[0],
        email: data[1],
        password: data[2],
        role: data[3],
        student_id: data[4],
        lecturer_id: data[5],
        created_at: data[6],
        updated_at: data[7]
    }
    return result;
}