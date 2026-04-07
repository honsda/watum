import type { Connection } from 'mysql2/promise';

export type InsertIntoCoursesParams = {
    id: string;
    name: string;
    credits: number;
    study_program_id: string;
    lecturer_id: string;
    created_at?: Date;
    updated_at?: Date;
}

export type InsertIntoCoursesResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertIntoCourses(connection: Connection, params: InsertIntoCoursesParams): Promise<InsertIntoCoursesResult> {
    const sql = `
    INSERT INTO courses
    (
        \`id\`,
        \`name\`,
        \`credits\`,
        \`study_program_id\`,
        \`lecturer_id\`,
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
        ?
    )
    `

    return connection.query(sql, [params.id, params.name, params.credits, params.study_program_id, params.lecturer_id, params.created_at, params.updated_at])
        .then(res => res[0] as InsertIntoCoursesResult);
}