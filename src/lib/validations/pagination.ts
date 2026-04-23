import * as v from 'valibot';

export const listPageEntries = {
	offset: v.optional(v.number())
};

export const listPageSchema = v.optional(v.object(listPageEntries));

export type ListPageInput = v.InferOutput<typeof listPageSchema>;
