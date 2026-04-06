import type { Connection } from 'mysql2/promise';

export type InsertIntoStudyProgramsParams = {
    id: string;
    name: string;
    head: string;
    faculty_id: string;
    created_at?: Date;
    updated_at?: Date;
}

export type InsertIntoStudyProgramsResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertIntoStudyPrograms(connection: Connection, params: InsertIntoStudyProgramsParams): Promise<InsertIntoStudyProgramsResult> {
    const sql = `
    INSERT INTO study_programs
    (
        \`id\`,
        \`name\`,
        \`head\`,
        \`faculty_id\`,
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
        ?
    )
    `

    return connection.query(sql, [params.id, params.name, params.head, params.faculty_id, params.created_at, params.updated_at])
        .then(res => res[0] as InsertIntoStudyProgramsResult);
}