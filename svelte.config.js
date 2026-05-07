import adapter from 'svelte-adapter-bun';
import { relative, sep } from 'node:path';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import remarkGfm from 'remark-gfm';

const mdsvexConfig = {
	extensions: ['.md', '.svx'],
	remarkPlugins: [remarkGfm]
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md', '.svx'],
	preprocess: [vitePreprocess(), mdsvex(mdsvexConfig)],
	compilerOptions: {
		// defaults to rune mode for the project, except for `node_modules`. Can be removed in svelte 6.
		runes: ({ filename }) => {
			const relativePath = relative(import.meta.dirname, filename);
			const pathSegments = relativePath.toLowerCase().split(sep);
			const isExternalLibrary = pathSegments.includes('node_modules');

			return isExternalLibrary ? undefined : true;
		},
		experimental: {
			async: true
		}
	},
	kit: {
		adapter: adapter({ precompress: true, dynamic_origin: true }),
		experimental: {
			remoteFunctions: true
		}
	}
};

export default config;
