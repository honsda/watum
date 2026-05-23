export type IssueForm = {
	fields?: {
		allIssues?: () => Array<{ message?: string }> | undefined;
	};
	result?: unknown;
};

type BulkMutationResult = {
	results?: Array<{ id?: string; ok?: boolean; message?: string }>;
};

export type EnhancedForm = IssueForm & {
	enhance: (callback: (opts: { submit: () => Promise<boolean> }) => void | Promise<void>) => {
		action: string;
		method: 'POST';
		[key: symbol]: (node: HTMLFormElement) => void;
	};
};

export function firstIssue(form: IssueForm) {
	return form?.fields?.allIssues?.()?.[0]?.message ?? null;
}

export function errorText(error: unknown, fallback = 'Aksi gagal diproses.') {
	return (
		(error as { body?: { message?: string }; message?: string })?.body?.message ||
		(error as Error)?.message ||
		fallback
	);
}

export function partialFailureMessage(result: unknown) {
	const failed = ((result as BulkMutationResult | undefined)?.results ?? []).filter(
		(item) => item.ok === false
	);
	if (!failed.length) return null;

	const detail = failed
		.slice(0, 5)
		.map((item) => [item.id, item.message].filter(Boolean).join(': '))
		.filter(Boolean)
		.join(', ');
	const suffix = failed.length > 5 ? `, dan ${failed.length - 5} lainnya` : '';

	return detail
		? `Sebagian data gagal diproses. ${detail}${suffix}`
		: 'Sebagian data gagal diproses.';
}

export function createEnhancer(
	form: EnhancedForm,
	onSuccess: () => Promise<void> | void,
	reportError: (message: string) => void
) {
	return form.enhance(async ({ submit }: { submit: () => Promise<boolean> }) => {
		try {
			await submit();
			const issue = firstIssue(form);
			if (issue) {
				reportError(issue);
				return;
			}
			const partialFailure = partialFailureMessage(form.result);
			if (partialFailure) {
				reportError(partialFailure);
				return;
			}
			await onSuccess();
		} catch (error) {
			reportError(errorText(error));
		}
	});
}

export function createOptimisticEnhancer(
	form: EnhancedForm,
	optimistic: () => void,
	onSuccess: () => Promise<void> | void,
	restore: () => Promise<void> | void,
	reportError: (message: string) => void
) {
	return form.enhance(async ({ submit }: { submit: () => Promise<boolean> }) => {
		let applied = false;
		try {
			optimistic();
			applied = true;
			await submit();
			const issue = firstIssue(form);
			if (issue) {
				reportError(issue);
				await restore();
				return;
			}
			const partialFailure = partialFailureMessage(form.result);
			if (partialFailure) {
				reportError(partialFailure);
				await restore();
				return;
			}
			await onSuccess();
		} catch (error) {
			reportError(errorText(error));
			if (applied) {
				await restore();
			}
		}
	});
}
