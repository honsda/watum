import type { Connection } from 'mysql2/promise';

export type UpdateGradeData = {
    assignment_score?: number;
    midterm_score?: number;
    final_score?: number;
    total_score?: number;
    letter_grade?: string;
}

export type UpdateGradeParams = {
    id: string;
}

export type UpdateGradeResult = {
    affectedRows: number;
}

export async function updateGrade(connection: Connection, data: UpdateGradeData, params: UpdateGradeParams): Promise<UpdateGradeResult> {
    const sql = `
    UPDATE grades
    SET assignment_score = ?,
        midterm_score = ?,
        final_score = ?,
        total_score = ?,
        letter_grade = ?
    WHERE id = ?
    `

    return connection.query(sql, [data.assignment_score, data.midterm_score, data.final_score, data.total_score, data.letter_grade, params.id])
        .then(res => res[0] as UpdateGradeResult);
}