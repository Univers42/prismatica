// Inlined into every page's <head> and hashed into the CSP by astro.config.mjs (Astro does not
// hash is:inline scripts). Marks JavaScript present and applies a stored light or dark choice
// before first paint. theme.ts migrates any older stored theme name on the first visit.
(() => {
	const root = document.documentElement;
	root.dataset.js = '';
	try {
		const stored = localStorage.getItem('prismatica-theme');
		if (stored === 'light' || stored === 'dark') root.dataset.theme = stored;
	} catch {
		// Storage blocked: follow the system theme.
	}
})();
