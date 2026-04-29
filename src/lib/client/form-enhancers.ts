export type IssueForm = {
	fields?: {
		allIssues?: () => Array<{ message?: string }> | undefined;
	};
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
			await onSuccess();
		} catch (error) {
			reportError(errorText(error));
			if (applied) {
				await restore();
			}
		}
	});
}
