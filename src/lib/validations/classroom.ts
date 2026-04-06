import * as v from 'valibot';

export const classRoomTypes = ['REGULER', 'LAB_KOMPUTER', 'LAB_BAHASA', 'AUDITORIUM'] as const;

export const classRoomSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nama ruangan wajib diisi'), v.maxLength(100)),
	classRoomType: v.picklist(classRoomTypes),
	capacity: v.pipe(v.number(), v.minValue(1, 'Kapasitas minimal 1'), v.maxValue(1000)),
	hasProjector: v.optional(v.boolean(), false),
	hasAC: v.optional(v.boolean(), false)
});