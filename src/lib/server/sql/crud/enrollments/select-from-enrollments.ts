import type { Connection } from 'mysql2/promise';

export type SelectFromEnrollmentsParams = {
    id: string;
}

export type SelectFromEnrollmentsResult = {
    id: string;
    student_id: string;
    course_id: string;
    class_room_id: string;
    lecturer_id: string;
    schedule_id: string;
    semester: string;
    academic_year: string;
    created_at?: Date;
    updated_at?: Date;
}

export async function selectFromEnrollments(connection: Connection, params: SelectFromEnrollmentsParams): Promise<SelectFromEnrollmentsResult | null> {
    const sql = `
    SELECT
        \`id\`,
        \`student_id\`,
        \`course_id\`,
        \`class_room_id\`,
        \`lecturer_id\`,
        \`schedule_id\`,
        \`semester\`,
        \`academic_year\`,
        \`created_at\`,
        \`updated_at\`
    FROM enrollments
    WHERE \`id\` = ?
    `

    return connection.query({sql, rowsAsArray: true}, [params.id])
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectFromEnrollmentsResult(data)))
        .then(res => res[0]);
}

function mapArrayToSelectFromEnrollmentsResult(data: any) {
    const result: SelectFromEnrollmentsResult = {
        id: data[0],
        student_id: data[1],
        course_id: data[2],
        class_room_id: data[3],
        lecturer_id: data[4],
        schedule_id: data[5],
        semester: data[6],
        academic_year: data[7],
        created_at: data[8],
        updated_at: data[9]
    }
    return result;
}