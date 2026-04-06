import type { Connection } from 'mysql2/promise';

export type InsertStudyProgramParams = {
    id: string;
    name: string;
    head: string;
    faculty_id: string;
}

export type InsertStudyProgramResult = {
    affectedRows: number;
    insertId: number;
}

export async function insertStudyProgram(connection: Connection, params: InsertStudyProgramParams): Promise<InsertStudyProgramResult> {
    const sql = `
    INSERT INTO study_programs (id, name, head, faculty_id)
    VALUES (?, ?, ?, ?)
    `

    return connection.query(sql, [params.id, params.name, params.head, params.faculty_id])
        .then(res => res[0] as InsertStudyProgramResult);
}