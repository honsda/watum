import type { Connection } from 'mysql2/promise';

export type InsertIntoGradesParams = {
    id: string;
    enrollment_id: string;
    assignment_score?: number;
    midterm_score?: number;
    final_score?: number;
    total_score?: number;
    letter_grade?: string;
    created_at?: Date;
    updated_at?: Date;
}

export type InsertIntoGradesResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertIntoGrades(connection: Connection, params: InsertIntoGradesParams): Promise<InsertIntoGradesResult> {
    const sql = `
    INSERT INTO grades
    (
        \`id\`,
        \`enrollment_id\`,
        \`assignment_score\`,
        \`midterm_score\`,
        \`final_score\`,
        \`total_score\`,
        \`letter_grade\`,
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

    return connection.query(sql, [params.id, params.enrollment_id, params.assignment_score, params.midterm_score, params.final_score, params.total_score, params.letter_grade, params.created_at, params.updated_at])
        .then(res => res[0] as InsertIntoGradesResult);
}