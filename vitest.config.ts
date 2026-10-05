import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'happy-dom',
		include: ['tests/**/*.test.{js,ts,mjs,mts}'],
		coverage: {
			reporter: ['text', 'json', 'html'],
		},
	},
});
