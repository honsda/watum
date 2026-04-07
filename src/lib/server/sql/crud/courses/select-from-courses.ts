import type { Connection } from 'mysql2/promise';

export type SelectFromCoursesParams = {
    id: string;
}

export type SelectFromCoursesResult = {
    id: string;
    name: string;
    credits: number;
    study_program_id: string;
    lecturer_id: string;
    created_at?: Date;
    updated_at?: Date;
}

export async function selectFromCourses(connection: Connection, params: SelectFromCoursesParams): Promise<SelectFromCoursesResult | null> {
    const sql = `
    SELECT
        \`id\`,
        \`name\`,
        \`credits\`,
        \`study_program_id\`,
        \`lecturer_id\`,
        \`created_at\`,
        \`updated_at\`
    FROM courses
    WHERE \`id\` = ?
    `

    return connection.query({sql, rowsAsArray: true}, [params.id])
        .then(res => res[0] as any[])
        .then(res => res.map(data => mapArrayToSelectFromCoursesResult(data)))
        .then(res => res[0]);
}

function mapArrayToSelectFromCoursesResult(data: any) {
    const result: SelectFromCoursesResult = {
        id: data[0],
        name: data[1],
        credits: data[2],
        study_program_id: data[3],
        lecturer_id: data[4],
        created_at: data[5],
        updated_at: data[6]
    }
    return result;
}