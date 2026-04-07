import type { Connection } from 'mysql2/promise';

export type InsertIntoEnrollmentsParams = {
    id: string;
    student_id: string;
    course_id: string;
    class_room_id: string;
    schedule_id: string;
    semester: string;
    academic_year: string;
    created_at?: Date;
    updated_at?: Date;
}

export type InsertIntoEnrollmentsResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertIntoEnrollments(connection: Connection, params: InsertIntoEnrollmentsParams): Promise<InsertIntoEnrollmentsResult> {
    const sql = `
    INSERT INTO enrollments
    (
        \`id\`,
        \`student_id\`,
        \`course_id\`,
        \`class_room_id\`,
        \`schedule_id\`,
        \`semester\`,
        \`academic_year\`,
        \`created_at\`,
        \`updated_at\`
    )
    VALUES
    (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
    )
    `

    return connection.query(sql, [params.id, params.student_id, params.course_id, params.class_room_id, params.schedule_id, params.semester, params.academic_year, params.created_at, params.updated_at])
        .then(res => res[0] as InsertIntoEnrollmentsResult);
}