import type { Connection } from 'mysql2/promise';

export type UpdateEnrollmentData = {
    student_id: string;
    course_id: string;
    class_room_id: string;
    schedule_day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
    schedule_start_time: Date;
    schedule_end_time: Date;
    semester: string;
    academic_year: string;
}

export type UpdateEnrollmentParams = {
    id: string;
}

export type UpdateEnrollmentResult = {
    affectedRows: number;
}

export async function updateEnrollment(connection: Connection, data: UpdateEnrollmentData, params: UpdateEnrollmentParams): Promise<UpdateEnrollmentResult> {
    const sql = `
    UPDATE enrollments
    SET student_id = ?, course_id = ?,
        class_room_id = ?, schedule_day = ?, schedule_start_time = ?,
        schedule_end_time = ?, semester = ?, academic_year = ?
    WHERE id = ?
    `

    return connection.query(sql, [
        data.student_id,
        data.course_id,
        data.class_room_id,
        data.schedule_day,
        data.schedule_start_time,
        data.schedule_end_time,
        data.semester,
        data.academic_year,
        params.id
    ])
        .then(res => res[0] as UpdateEnrollmentResult);
}
