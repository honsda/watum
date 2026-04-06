import type { Connection } from 'mysql2/promise';

export type DeleteStudentParams = {
    id: string;
}

export type DeleteStudentResult = {
    affectedRows: number;
}

export async function deleteStudent(connection: Connection, params: DeleteStudentParams): Promise<DeleteStudentResult> {
    const sql = `
    DELETE FROM students WHERE id = ?
    
    `

    return connection.query(sql, [params.id])
        .then(res => res[0] as DeleteStudentResult);
}