import type { Connection } from 'mysql2/promise';

export type UpdateEnrollmentData = {
    student_id?: string;
    course_id?: string;
    class_room_id?: string | null;
    schedule_id?: string | null;
    schedule_day?: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | null;
    schedule_start_time?: Date | string | null;
    schedule_end_time?: Date | string | null;
    semester?: string;
    academic_year?: string;
    status?: string;
}

export type UpdateEnrollmentParams = {
    id: string;
}

export type UpdateEnrollmentResult = {
    affectedRows: number;
}

export async function updateEnrollment(connection: Connection, data: UpdateEnrollmentData, params: UpdateEnrollmentParams): Promise<UpdateEnrollmentResult> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.student_id !== undefined) {
        fields.push('student_id = ?');
        values.push(data.student_id);
    }
    if (data.course_id !== undefined) {
        fields.push('course_id = ?');
        values.push(data.course_id);
    }
    if (data.class_room_id !== undefined) {
        fields.push('class_room_id = ?');
        values.push(data.class_room_id);
    }
    if (data.schedule_id !== undefined) {
        fields.push('schedule_id = ?');
        values.push(data.schedule_id);
    }
    if (data.schedule_day !== undefined) {
        fields.push('schedule_day = ?');
        values.push(data.schedule_day);
    }
    if (data.schedule_start_time !== undefined) {
        fields.push('schedule_start_time = ?');
        values.push(data.schedule_start_time);
    }
    if (data.schedule_end_time !== undefined) {
        fields.push('schedule_end_time = ?');
        values.push(data.schedule_end_time);
    }
    if (data.semester !== undefined) {
        fields.push('semester = ?');
        values.push(data.semester);
    }
    if (data.academic_year !== undefined) {
        fields.push('academic_year = ?');
        values.push(data.academic_year);
    }
    if (data.status !== undefined) {
        fields.push('status = ?');
        values.push(data.status);
    }

    if (!fields.length) {
        return { affectedRows: 0 };
    }

    const sql = `UPDATE enrollments SET ${fields.join(', ')} WHERE id = ?`;
    values.push(params.id);

    return connection.query(sql, values)
        .then(res => res[0] as UpdateEnrollmentResult);
}
