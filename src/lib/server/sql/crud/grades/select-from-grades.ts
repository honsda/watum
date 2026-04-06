import type { Connection } from 'mysql2/promise';

export type SelectFromGradesParams = {
    id: string;
}

export type SelectFromGradesResult = {
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

export async function selectFromGrades(connection: Connection, params: SelectFromGradesParams): Promise<SelectFromGradesResult | null> {
    const sql = `
    SELECT
        \`id\`,
        \`enrollment_id\`,
        \`assignment_score\`,
        \`midterm_score\`,
        \`final_score\`,
        \`total_score\`,
        \`letter_grade\`,
        \`created_at\`,
        \`updated_at\`
    FROM grades
    WHERE \`id\` = ?
    `

    return connection.query({sql, rowsAsArray: true}, [params.id])
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectFromGradesResult(data)))
        .then(res => res[0]);
}

function mapArrayToSelectFromGradesResult(data: any) {
    const result: SelectFromGradesResult = {
        id: data[0],
        enrollment_id: data[1],
        assignment_score: data[2],
        midterm_score: data[3],
        final_score: data[4],
        total_score: data[5],
        letter_grade: data[6],
        created_at: data[7],
        updated_at: data[8]
    }
    return result;
}