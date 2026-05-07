type Accessor<T> = {
	get: () => T;
	set: (value: T) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AccessorMap = Record<string, Accessor<any>>;

export function bindableLink<T>(get: () => T, set: (value: T) => void): Accessor<T> {
	return { get, set };
}

export function createBindableFacade<Spec extends AccessorMap>(
	spec: Spec
): {
	[K in keyof Spec]: ReturnType<Spec[K]['get']>;
} {
	const facade: Record<string, unknown> = {};

	for (const [key, accessor] of Object.entries(spec)) {
		Object.defineProperty(facade, key, {
			enumerable: true,
			configurable: true,
			get: accessor.get,
			set: accessor.set
		});
	}

	return facade as {
		[K in keyof Spec]: ReturnType<Spec[K]['get']>;
	};
}
