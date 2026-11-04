// Inlined into every page's <head> and hashed into the CSP by astro.config.mjs (Astro does not
// hash is:inline scripts). Marks JavaScript present, applies a stored light or dark choice, and
// sets the language and direction language.ts will settle on, all before first paint: an Arabic
// page must not paint left to right and then flip. theme.ts migrates any older stored theme name
// on the first visit.
(() => {
	const root = document.documentElement;
	root.dataset.js = '';
	let stored = null;
	try {
		const theme = localStorage.getItem('prismatica-theme');
		if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
		stored = localStorage.getItem('prismatica-lang');
	} catch {
		// Storage blocked: follow the system theme, and the URL for the language.
	}
	const wanted = new URLSearchParams(location.search).get('lang') ?? stored ?? '';
	const language = wanted.trim().toLowerCase().split(/[-_]/)[0];
	if (language === 'es' || language === 'ar') root.lang = language;
	if (language === 'ar') root.dir = 'rtl';
})();
