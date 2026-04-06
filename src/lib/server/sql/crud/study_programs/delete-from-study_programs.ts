import type { Connection } from 'mysql2/promise';

export type DeleteFromStudyProgramsParams = {
    id: string;
}

export type DeleteFromStudyProgramsResult = {
    affectedRows: number;
}

export async function deleteFromStudyPrograms(connection: Connection, params: DeleteFromStudyProgramsParams): Promise<DeleteFromStudyProgramsResult> {
    const sql = `
    DELETE FROM study_programs
    WHERE \`id\` = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteFromStudyProgramsResult);
}