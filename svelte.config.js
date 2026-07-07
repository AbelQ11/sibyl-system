import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ out: 'build' }),
		alias: {
			'$components': 'src/lib/components',
			'$lib': 'src/lib'
		},
		inlineStyleThreshold: 102400 // Inline styles up to 100kb to prevent Firefox Ctrl+F5 FOUC
	}
};

export default config;