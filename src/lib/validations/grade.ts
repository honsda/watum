import * as v from 'valibot';

export const gradeSchema = v.object({
	enrollmentId: v.string(),
	assignmentScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
	midtermScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
	finalScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100))
});

export function calculateGrade(
	assignment: number,
	midterm: number,
	final: number
): { total: number; letter: string } {
	const total = assignment * 0.3 + midterm * 0.3 + final * 0.4;

	let letter: string;
	if (total >= 85) letter = 'A';
	else if (total >= 70) letter = 'B';
	else if (total >= 55) letter = 'C';
	else if (total >= 40) letter = 'D';
	else letter = 'E';

	return { total, letter };
}

export const gradePoints: Record<string, number> = {
	A: 4.0,
	B: 3.0,
	C: 2.0,
	D: 1.0,
	E: 0.0
};
