import type { Connection } from 'mysql2/promise';

export type SelectLecturerScheduleConflictParams = {
	lecturerId: string;
	day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
	startTime: Date;
	endTime: Date;
	excludeScheduleId?: string;
};

export type SelectLecturerScheduleConflictResult = {
	id: string;
	start_time: Date;
	end_time: Date;
	course_name: string;
};

export async function selectLecturerScheduleConflict(
	connection: Connection,
	params: SelectLecturerScheduleConflictParams
): Promise<SelectLecturerScheduleConflictResult[]> {
	let sql = `
	SELECT sch.id, sch.start_time, sch.end_time, c.name AS course_name
	FROM schedules sch
	INNER JOIN enrollments e ON e.schedule_id = sch.id
	INNER JOIN courses c ON e.course_id = c.id
	WHERE c.lecturer_id = ?
	AND sch.day = ?
	AND sch.start_time < ?
	AND sch.end_time > ?
	`;
	const values: unknown[] = [params.lecturerId, params.day, params.endTime, params.startTime];

	if (params.excludeScheduleId) {
		sql += ` AND sch.id <> ?`;
		values.push(params.excludeScheduleId);
	}

	sql += ` ORDER BY sch.start_time ASC`;

	return connection
		.query({ sql, rowsAsArray: true }, values)
		.then((res) => res[0] as any[])
		.then((res) => res.map((data) => mapArrayToSelectLecturerScheduleConflictResult(data)));
}

function mapArrayToSelectLecturerScheduleConflictResult(data: any) {
	const result: SelectLecturerScheduleConflictResult = {
		id: data[0],
		start_time: data[1],
		end_time: data[2],
		course_name: data[3]
	};
	return result;
}
