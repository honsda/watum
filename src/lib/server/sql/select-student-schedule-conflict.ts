import type { Connection } from 'mysql2/promise';

export type SelectStudentScheduleConflictParams = {
	studentId: string;
	day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
	startTime: Date | string;
	endTime: Date | string;
	excludeEnrollmentId?: string;
};

export type SelectStudentScheduleConflictResult = {
	id: string;
	start_time: string;
	end_time: string;
	course_name: string;
};

export async function selectStudentScheduleConflict(
	connection: Connection,
	params: SelectStudentScheduleConflictParams
): Promise<SelectStudentScheduleConflictResult[]> {
	let sql = `
	SELECT e.id, e.schedule_start_time AS start_time, e.schedule_end_time AS end_time, c.name AS course_name
	FROM enrollments e
	INNER JOIN courses c ON e.course_id = c.id
	WHERE e.student_id = ?
	AND e.schedule_day = ?
	AND e.schedule_start_time < ?
	AND e.schedule_end_time > ?
	`;
	const values: unknown[] = [params.studentId, params.day, params.endTime, params.startTime];

	if (params.excludeEnrollmentId) {
		sql += ` AND e.id <> ?`;
		values.push(params.excludeEnrollmentId);
	}

	sql += ` ORDER BY e.schedule_start_time ASC`;

	return connection
		.query({ sql, rowsAsArray: true }, values)
		.then((res) => res[0] as any[])
		.then((res) => res.map((data) => mapArrayToSelectStudentScheduleConflictResult(data)));
}

function mapArrayToSelectStudentScheduleConflictResult(data: any) {
	const result: SelectStudentScheduleConflictResult = {
		id: data[0],
		start_time: data[1],
		end_time: data[2],
		course_name: data[3]
	};
	return result;
}
