import * as v from 'valibot';

export const listPageEntries = {
	cursor: v.optional(v.string())
};

export const listPageSchema = v.optional(v.object(listPageEntries));

export type ListPageInput = v.InferOutput<typeof listPageSchema>;
