import type { Connection } from 'mysql2/promise';

export type UpdateCoursesData = {
    id?: string;
    name?: string;
    credits?: number;
    study_program_id?: string;
    lecturer_id?: string;
    created_at?: Date | null;
    updated_at?: Date | null;
}

export type UpdateCoursesParams = {
    id: string;
}

export type UpdateCoursesResult = {
    affectedRows: number;
}

export async function updateCourses(connection: Connection, data: UpdateCoursesData, params: UpdateCoursesParams): Promise<UpdateCoursesResult> {
    const sql = `
    UPDATE courses
    SET
        \`id\` = CASE WHEN ? THEN ? ELSE \`id\` END,
        \`name\` = CASE WHEN ? THEN ? ELSE \`name\` END,
        \`credits\` = CASE WHEN ? THEN ? ELSE \`credits\` END,
        \`study_program_id\` = CASE WHEN ? THEN ? ELSE \`study_program_id\` END,
        \`lecturer_id\` = CASE WHEN ? THEN ? ELSE \`lecturer_id\` END,
        \`created_at\` = CASE WHEN ? THEN ? ELSE \`created_at\` END,
        \`updated_at\` = CASE WHEN ? THEN ? ELSE \`updated_at\` END
    WHERE
        \`id\` = ?
    `

    return connection.query(sql, [data.id !== undefined, data.id, data.name !== undefined, data.name, data.credits !== undefined, data.credits, data.study_program_id !== undefined, data.study_program_id, data.lecturer_id !== undefined, data.lecturer_id, data.created_at !== undefined, data.created_at, data.updated_at !== undefined, data.updated_at, params.id])
        .then(res => res[0] as UpdateCoursesResult);
}