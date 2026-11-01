import { defineConfig } from 'vitest/config';

export default defineConfig({
	// Unit tests run as local-dev: the portal injects the localhost Turnstile bypass
	// only when this exact site key is set (empty key is treated as production misconfig).
	define: {
		'import.meta.env.PUBLIC_TURNSTILE_SITE_KEY': JSON.stringify('local-dev-turnstile-key'),
	},
	test: {
		environment: 'happy-dom',
		include: ['tests/**/*.test.{js,ts,mjs,mts}'],
		env: {
			PUBLIC_TURNSTILE_SITE_KEY: 'local-dev-turnstile-key',
		},
		coverage: {
			reporter: ['text', 'json', 'html'],
		},
	},
});
