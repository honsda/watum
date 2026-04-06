import type { Connection } from 'mysql2/promise';

export type InsertCourseParams = {
    id: string;
    name: string;
    credits: number;
    study_program_id: string;
}

export type InsertCourseResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertCourse(connection: Connection, params: InsertCourseParams): Promise<InsertCourseResult> {
    const sql = `
    INSERT INTO courses (id, name, credits, study_program_id)
    VALUES (?, ?, ?, ?)
    `

    return connection.query(sql, [params.id, params.name, params.credits, params.study_program_id])
        .then(res => res[0] as InsertCourseResult);
}