import type { Connection } from 'mysql2/promise';

export type UpdateGradesData = {
    id?: string;
    enrollment_id?: string;
    assignment_score?: number | null;
    midterm_score?: number | null;
    final_score?: number | null;
    total_score?: number | null;
    letter_grade?: string | null;
    created_at?: Date | null;
    updated_at?: Date | null;
}

export type UpdateGradesParams = {
    id: string;
}

export type UpdateGradesResult = {
    affectedRows: number;
}

export async function updateGrades(connection: Connection, data: UpdateGradesData, params: UpdateGradesParams): Promise<UpdateGradesResult> {
    const sql = `
    UPDATE grades
    SET
        \`id\` = CASE WHEN ? THEN ? ELSE \`id\` END,
        \`enrollment_id\` = CASE WHEN ? THEN ? ELSE \`enrollment_id\` END,
        \`assignment_score\` = CASE WHEN ? THEN ? ELSE \`assignment_score\` END,
        \`midterm_score\` = CASE WHEN ? THEN ? ELSE \`midterm_score\` END,
        \`final_score\` = CASE WHEN ? THEN ? ELSE \`final_score\` END,
        \`total_score\` = CASE WHEN ? THEN ? ELSE \`total_score\` END,
        \`letter_grade\` = CASE WHEN ? THEN ? ELSE \`letter_grade\` END,
        \`created_at\` = CASE WHEN ? THEN ? ELSE \`created_at\` END,
        \`updated_at\` = CASE WHEN ? THEN ? ELSE \`updated_at\` END
    WHERE
        \`id\` = ?
    `

    return connection.query(sql, [data.id !== undefined, data.id, data.enrollment_id !== undefined, data.enrollment_id, data.assignment_score !== undefined, data.assignment_score, data.midterm_score !== undefined, data.midterm_score, data.final_score !== undefined, data.final_score, data.total_score !== undefined, data.total_score, data.letter_grade !== undefined, data.letter_grade, data.created_at !== undefined, data.created_at, data.updated_at !== undefined, data.updated_at, params.id])
        .then(res => res[0] as UpdateGradesResult);
}