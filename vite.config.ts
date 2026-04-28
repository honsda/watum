import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { analyzer } from 'vite-bundle-analyzer';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		analyzer({
			analyzerMode: 'static',
			openAnalyzer: false,
			defaultSizes: 'gzip',
			fileName: 'bundle-stats'
		})
	],
	build: {
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
				passes: 2,
				unsafe_math: true
			},
			format: {
				comments: false
			}
		},
		target: 'es2022'
	}
});
