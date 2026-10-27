import { beforeEach, describe, expect, it } from 'vitest';
import { showAuthResult } from '../../../src/scripts/auth-result';

// The parts src/components/ui/AuthResult.astro renders, in their initial state.
function card(): HTMLElement {
	const section = document.createElement('section');
	section.dataset.tone = 'loading';
	section.hidden = true;
	const parts: Array<[string, string]> = [
		['h1', 'title'],
		['p', 'message'],
		['div', 'next'],
		['ol', 'steps'],
		['div', 'actions'],
		['button', 'action'],
		['a', 'continue'],
		['p', 'reference'],
		['code', 'code'],
	];
	for (const [tag, name] of parts) {
		const element = document.createElement(tag);
		element.setAttribute(`data-result-${name}`, '');
		if (['next', 'actions', 'continue', 'reference'].includes(name)) element.hidden = true;
		if (name === 'title') element.tabIndex = -1;
		section.append(element);
	}
	document.body.replaceChildren(section);
	return section;
}

const part = (section: HTMLElement, name: string) => section.querySelector<HTMLElement>(`[data-result-${name}]`)!;

describe('showAuthResult', () => {
	beforeEach(() => document.body.replaceChildren());

	it('fills every part of the outcome and moves focus to the title', () => {
		const section = card();
		showAuthResult(section, { tone: 'notice', title: 'Link expired', message: 'It was used.', steps: ['One', 'Two'], action: 'Sign in', code: 'oauth_flow_missing' });
		expect(section.hidden).toBe(false);
		expect(section.dataset.tone).toBe('notice');
		expect(document.title).toBe('Link expired · Prismatica');
		expect(part(section, 'message').textContent).toBe('It was used.');
		expect([...part(section, 'steps').children].map((item) => item.textContent)).toEqual(['One', 'Two']);
		expect(part(section, 'next').hidden).toBe(false);
		expect(part(section, 'action').textContent).toBe('Sign in');
		expect(part(section, 'action').hidden).toBe(false);
		expect(part(section, 'actions').hidden).toBe(false);
		expect(part(section, 'code').textContent).toBe('oauth_flow_missing');
		expect(part(section, 'reference').hidden).toBe(false);
		expect(document.activeElement).toBe(part(section, 'title'));
	});

	it('hides the parts an outcome does not use', () => {
		const section = card();
		showAuthResult(section, { tone: 'success', title: 'Done', message: 'All set.', steps: [] });
		expect(part(section, 'next').hidden).toBe(true);
		expect(part(section, 'action').hidden).toBe(true);
		expect(part(section, 'actions').hidden).toBe(false);
		expect(part(section, 'reference').hidden).toBe(true);
	});

	it('turns the action into a link to the given page instead of the sign-in button', () => {
		const section = card();
		showAuthResult(section, { tone: 'success', title: 'Signed in', message: 'Password removed.', steps: [], action: 'Open your workspace', continueUrl: 'https://app.test/workspace' });
		const link = part(section, 'continue') as HTMLAnchorElement;
		expect(link.hidden).toBe(false);
		expect(link.textContent).toBe('Open your workspace');
		expect(link.href).toBe('https://app.test/workspace');
		expect(part(section, 'action').hidden).toBe(true);
	});

	it('renders gateway text as text, never as markup', () => {
		const section = card();
		showAuthResult(section, { tone: 'danger', title: '<img src=x>', message: '<b>bold</b>', steps: ['<i>step</i>'] });
		expect(section.querySelector('img, b, i')).toBeNull();
		expect(part(section, 'message').textContent).toBe('<b>bold</b>');
	});
});
