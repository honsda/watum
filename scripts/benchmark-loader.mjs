export async function resolve(specifier, context, nextResolve) {
	if (specifier === '$env/dynamic/private') {
		return {
			url: new URL('./benchmark-env.mjs', import.meta.url).href,
			shortCircuit: true
		};
	}
	// Allow .js imports to resolve to .ts source files for benchmark scripts
	if (specifier.startsWith('.') && specifier.endsWith('.js')) {
		const tsSpecifier = specifier.slice(0, -3) + '.ts';
		try {
			const result = await nextResolve(tsSpecifier, context);
			return { ...result, url: result.url };
		} catch {
			// fall through to default
		}
	}
	return nextResolve(specifier, context);
}
