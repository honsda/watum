import type { Connection } from 'mysql2/promise';

export type DeleteStudyProgramParams = {
    id: string;
}

export type DeleteStudyProgramResult = {
    affectedRows: number;
}

export async function deleteStudyProgram(connection: Connection, params: DeleteStudyProgramParams): Promise<DeleteStudyProgramResult> {
    const sql = `
    DELETE FROM study_programs WHERE id = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteStudyProgramResult);
}