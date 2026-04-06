import type { Connection } from 'mysql2/promise';

export type UpdateCourseData = {
    name: string;
    credits: number;
    study_program_id: string;
}

export type UpdateCourseParams = {
    id: string;
}

export type UpdateCourseResult = {
    affectedRows: number;
}

export async function updateCourse(connection: Connection, data: UpdateCourseData, params: UpdateCourseParams): Promise<UpdateCourseResult> {
    const sql = `
    UPDATE courses
    SET name = ?,
        credits = ?,
        study_program_id = ?
    WHERE id = ?
    `

    return connection.query(sql, [data.name, data.credits, data.study_program_id, params.id])
        .then(res => res[0] as UpdateCourseResult);
}