import type { Connection } from 'mysql2/promise';

export type UpdateEnrollmentsData = {
    id?: string;
    student_id?: string;
    course_id?: string;
    class_room_id?: string;
    lecturer_id?: string;
    schedule_id?: string;
    semester?: string;
    academic_year?: string;
    created_at?: Date | null;
    updated_at?: Date | null;
}

export type UpdateEnrollmentsParams = {
    id: string;
}

export type UpdateEnrollmentsResult = {
    affectedRows: number;
}

export async function updateEnrollments(connection: Connection, data: UpdateEnrollmentsData, params: UpdateEnrollmentsParams): Promise<UpdateEnrollmentsResult> {
    const sql = `
    UPDATE enrollments
    SET
        \`id\` = CASE WHEN ? THEN ? ELSE \`id\` END,
        \`student_id\` = CASE WHEN ? THEN ? ELSE \`student_id\` END,
        \`course_id\` = CASE WHEN ? THEN ? ELSE \`course_id\` END,
        \`class_room_id\` = CASE WHEN ? THEN ? ELSE \`class_room_id\` END,
        \`lecturer_id\` = CASE WHEN ? THEN ? ELSE \`lecturer_id\` END,
        \`schedule_id\` = CASE WHEN ? THEN ? ELSE \`schedule_id\` END,
        \`semester\` = CASE WHEN ? THEN ? ELSE \`semester\` END,
        \`academic_year\` = CASE WHEN ? THEN ? ELSE \`academic_year\` END,
        \`created_at\` = CASE WHEN ? THEN ? ELSE \`created_at\` END,
        \`updated_at\` = CASE WHEN ? THEN ? ELSE \`updated_at\` END
    WHERE
        \`id\` = ?
    `

    return connection.query(sql, [data.id !== undefined, data.id, data.student_id !== undefined, data.student_id, data.course_id !== undefined, data.course_id, data.class_room_id !== undefined, data.class_room_id, data.lecturer_id !== undefined, data.lecturer_id, data.schedule_id !== undefined, data.schedule_id, data.semester !== undefined, data.semester, data.academic_year !== undefined, data.academic_year, data.created_at !== undefined, data.created_at, data.updated_at !== undefined, data.updated_at, params.id])
        .then(res => res[0] as UpdateEnrollmentsResult);
}