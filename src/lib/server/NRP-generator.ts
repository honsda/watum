import { getPool } from './db';
import { selectStudyPrograms, selectStudents } from './sql';

export async function generateNRP(studyProgramId: string, yearAdmitted: number): Promise<string> {
	const [studyProgram] = await selectStudyPrograms(getPool(), {
		where: [['id', '=', studyProgramId]]
	});
	if (!studyProgram) {
		throw new Error('Program studi tidak ditemukan');
	}

	const yearCode = yearAdmitted.toString().slice(-2);
	const facultyCode = (studyProgram.faculty_id ?? '').padStart(2, '0');
	const studyProgramCode = studyProgramId.padStart(2, '0');

	const students = await selectStudents(getPool(), {
		select: { id: true },
		where: [
			['study_program_id', '=', studyProgramId],
			['year_admitted', '=', yearAdmitted]
		]
	});

	const count = students.length;
	const sequence = (count + 1).toString().padStart(3, '0');

	return `${yearCode}${facultyCode}${studyProgramCode}${sequence}`;
}
