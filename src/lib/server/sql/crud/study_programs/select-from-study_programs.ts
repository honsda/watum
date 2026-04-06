import type { Connection } from 'mysql2/promise';

export type SelectFromStudyProgramsParams = {
    id: string;
}

export type SelectFromStudyProgramsResult = {
    id: string;
    name: string;
    head: string;
    faculty_id: string;
    created_at?: Date;
    updated_at?: Date;
}

export async function selectFromStudyPrograms(connection: Connection, params: SelectFromStudyProgramsParams): Promise<SelectFromStudyProgramsResult | null> {
    const sql = `
    SELECT
        \`id\`,
        \`name\`,
        \`head\`,
        \`faculty_id\`,
        \`created_at\`,
        \`updated_at\`
    FROM study_programs
    WHERE \`id\` = ?
    `

    return connection.query({sql, rowsAsArray: true}, [params.id])
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectFromStudyProgramsResult(data)))
        .then(res => res[0]);
}

function mapArrayToSelectFromStudyProgramsResult(data: any) {
    const result: SelectFromStudyProgramsResult = {
        id: data[0],
        name: data[1],
        head: data[2],
        faculty_id: data[3],
        created_at: data[4],
        updated_at: data[5]
    }
    return result;
}