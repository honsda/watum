import type { Connection } from 'mysql2/promise';

export type InsertGradeParams = {
    id: string;
    enrollment_id: string;
    assignment_score?: number;
    midterm_score?: number;
    final_score?: number;
    total_score?: number;
    letter_grade?: string;
}

export type InsertGradeResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertGrade(connection: Connection, params: InsertGradeParams): Promise<InsertGradeResult> {
    const sql = `
    INSERT INTO grades (id, enrollment_id, assignment_score, midterm_score, final_score, total_score, letter_grade)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `

    return connection.query(sql, [params.id, params.enrollment_id, params.assignment_score, params.midterm_score, params.final_score, params.total_score, params.letter_grade])
        .then(res => res[0] as InsertGradeResult);
}