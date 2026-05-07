type AsyncMaybe<T = void> = T | Promise<T>;

type RefreshPlan = {
	collections: readonly string[];
	includeSchedulePreview?: boolean;
	includeConflictAudit?: boolean;
};

type DeletePlan = {
	execute: (id: string) => Promise<unknown>;
	refresh: RefreshPlan;
	afterDelete: (id: string) => AsyncMaybe;
};

type BulkDeletePlan = {
	execute: (id: string) => Promise<unknown>;
	refresh: RefreshPlan;
	afterDelete: () => AsyncMaybe;
};

export async function runDeletePlan<K extends string>(options: {
	kind: K;
	id: string;
	singlePlans: Partial<Record<K, DeletePlan>>;
	bulkPlans: Partial<Record<K, BulkDeletePlan>>;
	refresh: (plan: {
		collections: string[];
		includeSchedulePreview?: boolean;
		includeConflictAudit?: boolean;
	}) => Promise<void>;
	onSuccess: (message: string) => void;
	onFailure: (message: string) => void;
	intent: { successMessage?: string; failureMessage?: string };
}) {
	try {
		if (options.kind in options.singlePlans) {
			const plan = options.singlePlans[options.kind]!;
			await plan.execute(options.id);
			await options.refresh({
				...plan.refresh,
				collections: [...plan.refresh.collections]
			});
			await plan.afterDelete(options.id);
		}

		if (options.kind in options.bulkPlans) {
			const plan = options.bulkPlans[options.kind]!;
			await plan.execute(options.id);
			await options.refresh({
				...plan.refresh,
				collections: [...plan.refresh.collections]
			});
			await plan.afterDelete();
		}

		options.onSuccess(options.intent.successMessage ?? 'Data berhasil dihapus.');
	} catch (error) {
		const message = (error as { body?: { message?: string }; message?: string })?.body?.message;
		options.onFailure(message || options.intent.failureMessage || 'Penghapusan gagal.');
	}
}
