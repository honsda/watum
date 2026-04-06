import type { Connection } from 'mysql2/promise';

export type UpdateStudentsData = {
    id?: string;
    name?: string;
    email?: string;
    phone?: string | null;
    address?: string | null;
    year_admitted?: number;
    study_program_id?: string;
    created_at?: Date | null;
    updated_at?: Date | null;
}

export type UpdateStudentsParams = {
    id: string;
}

export type UpdateStudentsResult = {
    affectedRows: number;
}

export async function updateStudents(connection: Connection, data: UpdateStudentsData, params: UpdateStudentsParams): Promise<UpdateStudentsResult> {
    const sql = `
    UPDATE students
    SET
        \`id\` = CASE WHEN ? THEN ? ELSE \`id\` END,
        \`name\` = CASE WHEN ? THEN ? ELSE \`name\` END,
        \`email\` = CASE WHEN ? THEN ? ELSE \`email\` END,
        \`phone\` = CASE WHEN ? THEN ? ELSE \`phone\` END,
        \`address\` = CASE WHEN ? THEN ? ELSE \`address\` END,
        \`year_admitted\` = CASE WHEN ? THEN ? ELSE \`year_admitted\` END,
        \`study_program_id\` = CASE WHEN ? THEN ? ELSE \`study_program_id\` END,
        \`created_at\` = CASE WHEN ? THEN ? ELSE \`created_at\` END,
        \`updated_at\` = CASE WHEN ? THEN ? ELSE \`updated_at\` END
    WHERE
        \`id\` = ?
    `

    return connection.query(sql, [data.id !== undefined, data.id, data.name !== undefined, data.name, data.email !== undefined, data.email, data.phone !== undefined, data.phone, data.address !== undefined, data.address, data.year_admitted !== undefined, data.year_admitted, data.study_program_id !== undefined, data.study_program_id, data.created_at !== undefined, data.created_at, data.updated_at !== undefined, data.updated_at, params.id])
        .then(res => res[0] as UpdateStudentsResult);
}