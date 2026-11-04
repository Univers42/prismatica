import { beforeEach, describe, expect, it } from 'vitest';
import { RELEASE } from '../../../src/data/links';
import { POLICY_VERSION } from '../../../src/data/legal';
import { t } from '../../../src/lib/i18n';
import { applyLocale } from '../../../src/scripts/language';
import { announce, applyTheme } from '../../../src/scripts/theme';

const text = (selector: string): string | null | undefined => document.querySelector(selector)?.textContent;
const attribute = (selector: string, name: string): string | null | undefined => document.querySelector(selector)?.getAttribute(name);

describe('applyLocale on a page', () => {
	beforeEach(() => {
		localStorage.clear();
		document.head.innerHTML = '<title data-i18n="site.meta.landingTitle">English title</title>';
		document.body.innerHTML = `
			<h1 data-i18n="site.hero.title">English</h1>
			<nav id="named" aria-label="Main" data-i18n-aria-label="site.nav.main"></nav>
			<img id="shot" alt="English" data-i18n-alt="site.shots.S1.alt" />
			<span id="amount" data-i18n-amount="17570">€17,570</span>
			<p id="engine" data-i18n="site.run.localBody"></p>
			<p id="backend" data-i18n="site.run.backendBefore"></p>
			<p id="version" data-i18n="site.consent.version"></p>
			<button data-theme-toggle></button>
			<a class="lang-switcher"><span class="header-icon__lang-badge"></span><span data-lang-label></span></a>`;
	});

	it('swaps text', () => {
		applyLocale('es');
		expect(text('h1')).toBe(t('es', 'site.hero.title'));
	});

	it('swaps the page title', () => {
		applyLocale('ar');
		expect(document.title).toBe(t('ar', 'site.meta.landingTitle'));
	});

	it('swaps an accessible name without touching the content', () => {
		applyLocale('ar');
		expect(attribute('#named', 'aria-label')).toBe(t('ar', 'site.nav.main'));
	});

	it('swaps image alt text', () => {
		applyLocale('es');
		expect(attribute('#shot', 'alt')).toBe(t('es', 'site.shots.S1.alt'));
	});

	it('reformats amounts', () => {
		applyLocale('es');
		expect(text('#amount')?.replace(/\s/g, ' ')).toBe('17.570 €');
		applyLocale('en');
		expect(text('#amount')).toBe('€17,570');
	});

	it('fills release and policy values, leaving no placeholder on screen', () => {
		applyLocale('es');
		expect(text('#engine')).toContain(RELEASE.engine);
		expect(text('#backend')).toContain(RELEASE.backend);
		expect(text('#version')).toContain(POLICY_VERSION);
		expect(document.body.textContent).not.toMatch(/{[a-z]+}/);
	});

	it('translates an announcement made before the dictionary arrived', () => {
		document.body.insertAdjacentHTML('beforeend', '<div id="global-announcer"></div>');
		announce('Privacy choices: choose your consent preferences.', 'site.consent.announcement');
		applyLocale('ar');
		expect(text('#global-announcer')).toBe(t('ar', 'site.consent.announcement'));
	});

	it('translates an announcement made after it arrived', () => {
		document.body.insertAdjacentHTML('beforeend', '<div id="global-announcer"></div>');
		applyLocale('es');
		announce('Consent preferences saved.', 'site.consent.saved');
		expect(text('#global-announcer')).toBe(t('es', 'site.consent.saved'));
	});

	it('leaves an announcement with no key as written, and does not re-translate it later', () => {
		document.body.insertAdjacentHTML('beforeend', '<div id="global-announcer"></div>');
		announce('Consent preferences saved.', 'site.consent.saved');
		announce('Workspace portal opened');
		applyLocale('es');
		expect(text('#global-announcer')).toBe('Workspace portal opened');
	});

	it('names the switcher in the language on screen', () => {
		applyLocale('es');
		expect(attribute('.lang-switcher', 'aria-label')).toBe('ES - Idioma: Español. Cambiar a العربية');
		expect(attribute('.lang-switcher', 'title')).toBe('Cambiar a العربية');
		expect(text('[data-lang-label]')).toBe('Idioma: Español');
	});

	it('keeps the English switcher name a screen reader had before', () => {
		applyLocale('en');
		expect(attribute('.lang-switcher', 'aria-label')).toBe('EN - Language: English. Switch to Español');
	});

	it('names the theme toggle in the language on screen, including after a theme change', () => {
		applyLocale('es');
		expect(attribute('[data-theme-toggle]', 'aria-label')).toBe('Tema: Según el sistema. Cambiar a Claro');
		applyTheme('dark');
		expect(attribute('[data-theme-toggle]', 'aria-label')).toBe('Tema: Oscuro. Cambiar a Según el sistema');
	});
});
