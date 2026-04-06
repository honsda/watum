import type { Connection } from 'mysql2/promise';

export type UpdateStudyProgramsData = {
    id?: string;
    name?: string;
    head?: string;
    faculty_id?: string;
    created_at?: Date | null;
    updated_at?: Date | null;
}

export type UpdateStudyProgramsParams = {
    id: string;
}

export type UpdateStudyProgramsResult = {
    affectedRows: number;
}

export async function updateStudyPrograms(connection: Connection, data: UpdateStudyProgramsData, params: UpdateStudyProgramsParams): Promise<UpdateStudyProgramsResult> {
    const sql = `
    UPDATE study_programs
    SET
        \`id\` = CASE WHEN ? THEN ? ELSE \`id\` END,
        \`name\` = CASE WHEN ? THEN ? ELSE \`name\` END,
        \`head\` = CASE WHEN ? THEN ? ELSE \`head\` END,
        \`faculty_id\` = CASE WHEN ? THEN ? ELSE \`faculty_id\` END,
        \`created_at\` = CASE WHEN ? THEN ? ELSE \`created_at\` END,
        \`updated_at\` = CASE WHEN ? THEN ? ELSE \`updated_at\` END
    WHERE
        \`id\` = ?
    `

    return connection.query(sql, [data.id !== undefined, data.id, data.name !== undefined, data.name, data.head !== undefined, data.head, data.faculty_id !== undefined, data.faculty_id, data.created_at !== undefined, data.created_at, data.updated_at !== undefined, data.updated_at, params.id])
        .then(res => res[0] as UpdateStudyProgramsResult);
}