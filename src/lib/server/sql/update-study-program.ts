import type { Connection } from 'mysql2/promise';

export type UpdateStudyProgramData = {
    name: string;
    head: string;
    faculty_id: string;
}

export type UpdateStudyProgramParams = {
    id: string;
}

export type UpdateStudyProgramResult = {
    affectedRows: number;
}

export async function updateStudyProgram(connection: Connection, data: UpdateStudyProgramData, params: UpdateStudyProgramParams): Promise<UpdateStudyProgramResult> {
    const sql = `
    UPDATE study_programs
    SET name = ?,
        head = ?,
        faculty_id = ?
    WHERE id = ?
    `

    return connection.query(sql, [data.name, data.head, data.faculty_id, params.id])
        .then(res => res[0] as UpdateStudyProgramResult);
}