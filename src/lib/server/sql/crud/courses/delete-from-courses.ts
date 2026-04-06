import type { Connection } from 'mysql2/promise';

export type DeleteFromCoursesParams = {
    id: string;
}

export type DeleteFromCoursesResult = {
    affectedRows: number;
}

export async function deleteFromCourses(connection: Connection, params: DeleteFromCoursesParams): Promise<DeleteFromCoursesResult> {
    const sql = `
    DELETE FROM courses
    WHERE \`id\` = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteFromCoursesResult);
}