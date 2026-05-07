type AsyncVoid = () => Promise<void> | void;

export function createRefreshOnly<TPlan>(options: {
	refresh: (plan: TPlan) => Promise<void>;
	plan: () => TPlan;
}) {
	return async () => {
		await options.refresh(options.plan());
	};
}

export function createRefreshSuccess<TPlan>(options: {
	refresh: (plan: TPlan) => Promise<void>;
	plan: () => TPlan;
	after?: AsyncVoid;
	notify: (message: string) => void;
	message: string;
}) {
	return async () => {
		await options.refresh(options.plan());
		await options.after?.();
		options.notify(options.message);
	};
}

export function buildCreateRefreshEnhancer<TForm, TPlan, TEnhancer>(options: {
	createEnhancer: (form: TForm, onSuccess: AsyncVoid) => TEnhancer;
	form: TForm;
	refresh: (plan: TPlan) => Promise<void>;
	plan: () => TPlan;
	after?: AsyncVoid;
	notify: (message: string) => void;
	message: string;
}) {
	return options.createEnhancer(
		options.form,
		createRefreshSuccess({
			refresh: options.refresh,
			plan: options.plan,
			after: options.after,
			notify: options.notify,
			message: options.message
		})
	);
}

export function buildOptimisticRefreshEnhancer<TForm, TPlan, TEnhancer>(options: {
	createOptimisticEnhancer: (
		form: TForm,
		optimistic: AsyncVoid,
		onSuccess: AsyncVoid,
		onRestore: AsyncVoid
	) => TEnhancer;
	form: TForm;
	optimistic: AsyncVoid;
	refresh: (plan: TPlan) => Promise<void>;
	plan: () => TPlan;
	after?: AsyncVoid;
	notify: (message: string) => void;
	message: string;
}) {
	return options.createOptimisticEnhancer(
		options.form,
		options.optimistic,
		createRefreshSuccess({
			refresh: options.refresh,
			plan: options.plan,
			after: options.after,
			notify: options.notify,
			message: options.message
		}),
		createRefreshOnly({
			refresh: options.refresh,
			plan: options.plan
		})
	);
}
