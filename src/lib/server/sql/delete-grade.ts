import type { Connection } from 'mysql2/promise';

export type DeleteGradeParams = {
    id: string;
}

export type DeleteGradeResult = {
    affectedRows: number;
}

export async function deleteGrade(connection: Connection, params: DeleteGradeParams): Promise<DeleteGradeResult> {
    const sql = `
    DELETE FROM grades WHERE id = ?
    
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteGradeResult);
}