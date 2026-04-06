import type { Connection } from 'mysql2/promise';

export type DeleteEnrollmentParams = {
    id: string;
}

export type DeleteEnrollmentResult = {
    affectedRows: number;
}

export async function deleteEnrollment(connection: Connection, params: DeleteEnrollmentParams): Promise<DeleteEnrollmentResult> {
    const sql = `
    DELETE FROM enrollments WHERE id = ?
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteEnrollmentResult);
}