import type { Connection } from 'mysql2/promise';

export type InsertEnrollmentParams = {
    id: string;
    student_id: string;
    course_id: string;
    class_room_id: string;
    lecturer_id: string;
    schedule_id: string;
    semester: string;
    academic_year: string;
}

export type InsertEnrollmentResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertEnrollment(connection: Connection, params: InsertEnrollmentParams): Promise<InsertEnrollmentResult> {
    const sql = `
    INSERT INTO enrollments (id, student_id, course_id, class_room_id, lecturer_id, schedule_id, semester, academic_year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `

    return connection.query(sql, [params.id, params.student_id, params.course_id, params.class_room_id, params.lecturer_id, params.schedule_id, params.semester, params.academic_year])
        .then(res => res[0] as InsertEnrollmentResult);
}