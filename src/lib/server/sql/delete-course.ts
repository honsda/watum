import type { Connection } from 'mysql2/promise';

export type DeleteCourseParams = {
    id: string;
}

export type DeleteCourseResult = {
    affectedRows: number;
}

export async function deleteCourse(connection: Connection, params: DeleteCourseParams): Promise<DeleteCourseResult> {
    const sql = `
    DELETE FROM courses WHERE id = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteCourseResult);
}