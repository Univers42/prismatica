import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindWorkspaceDemo } from '../../../src/scripts/hero-workspace';

const APPS = [
	{ id: 'docs', command: 'page' },
	{ id: 'board', command: 'board' },
	{ id: 'calendar', command: 'calendar' },
];

function mountWorkspace(): HTMLElement {
	document.body.innerHTML = `
		<div data-workspace>
			<button type="button" data-workspace-trigger aria-expanded="false"><span data-workspace-typed></span></button>
			<div data-workspace-menu hidden>
				<ul>${APPS.map((app) => `<li><button type="button" data-workspace-item="${app.id}" data-command="${app.command}" aria-pressed="false">${app.id}</button></li>`).join('')}</ul>
			</div>
			${APPS.map((app) => `<div data-workspace-block="${app.id}" ${app.id === 'board' ? '' : 'hidden'}></div>`).join('')}
			${APPS.map((app) => `<button type="button" data-workspace-node="${app.id}" aria-pressed="${app.id === 'board'}"></button>`).join('')}
		</div>
		<p id="outside">outside</p>`;
	return document.querySelector<HTMLElement>('[data-workspace]')!;
}

const block = (id: string) => document.querySelector<HTMLElement>(`[data-workspace-block="${id}"]`)!;
const menu = () => document.querySelector<HTMLElement>('[data-workspace-menu]')!;
const trigger = () => document.querySelector<HTMLButtonElement>('[data-workspace-trigger]')!;
const item = (id: string) => document.querySelector<HTMLButtonElement>(`[data-workspace-item="${id}"]`)!;
const node = (id: string) => document.querySelector<HTMLButtonElement>(`[data-workspace-node="${id}"]`)!;
const typed = () => document.querySelector<HTMLElement>('[data-workspace-typed]')!.textContent;

describe('hero workspace demo', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	it('opens the full menu from the trigger and drops the chosen app in as a block', () => {
		bindWorkspaceDemo(mountWorkspace(), { autoplay: false });
		trigger().click();
		expect(menu().hidden).toBe(false);
		expect(trigger().getAttribute('aria-expanded')).toBe('true');
		expect(typed()).toBe('/');

		item('calendar').click();
		vi.advanceTimersByTime(300);
		expect(block('calendar').hidden).toBe(false);
		expect(block('board').hidden).toBe(true);
		expect(item('calendar').getAttribute('aria-pressed')).toBe('true');
		expect(menu().hidden).toBe(true);
		expect(document.activeElement).toBe(trigger());
	});

	it('closes the menu on Escape and returns focus to the trigger', () => {
		const root = mountWorkspace();
		bindWorkspaceDemo(root, { autoplay: false });
		trigger().click();
		root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(menu().hidden).toBe(true);
		expect(document.activeElement).toBe(trigger());
	});

	it('closes a visitor-opened menu on a tap outside', () => {
		bindWorkspaceDemo(mountWorkspace(), { autoplay: false });
		trigger().click();
		document.getElementById('outside')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		expect(menu().hidden).toBe(true);
	});

	it('autoplays: types the command, filters the menu, then inserts the next app', () => {
		// First cycle starts after holdMs / 2, waits 3 keystrokes, then types one letter per tick.
		bindWorkspaceDemo(mountWorkspace(), { autoplay: true, order: ['board', 'calendar'], typeDelayMs: 10, holdMs: 1000 });
		vi.advanceTimersByTime(500 + 30 + 10 * 3);
		expect(menu().hidden).toBe(false);
		expect(typed()).toBe('/cal');
		expect(item('board').closest('li')!.hidden).toBe(true);
		expect(item('calendar').classList.contains('is-active')).toBe(true);

		vi.advanceTimersByTime(10 * 10 + 300);
		expect(menu().hidden).toBe(true);
		expect(block('calendar').hidden).toBe(false);
		expect(block('board').hidden).toBe(true);
	});

	it('hands control to the visitor on the first touch', () => {
		const root = mountWorkspace();
		bindWorkspaceDemo(root, { autoplay: true, order: ['board', 'calendar'], typeDelayMs: 10, holdMs: 100 });
		root.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		vi.advanceTimersByTime(5000);
		expect(block('board').hidden).toBe(false);
		expect(block('calendar').hidden).toBe(true);
		expect(menu().hidden).toBe(true);
	});

	it('inserts an app from its rail node and presses only that node', () => {
		bindWorkspaceDemo(mountWorkspace(), { autoplay: false });
		node('docs').click();
		vi.advanceTimersByTime(300);
		expect(block('docs').hidden).toBe(false);
		expect(block('board').hidden).toBe(true);
		expect(node('docs').getAttribute('aria-pressed')).toBe('true');
		expect(node('board').getAttribute('aria-pressed')).toBe('false');
		expect(item('docs').getAttribute('aria-pressed')).toBe('true');
	});

	it('announces each newly inserted app to the page, once', () => {
		const heard: string[] = [];
		document.addEventListener('workspace:select', (event) => heard.push((event as CustomEvent<{ id: string }>).detail.id));
		bindWorkspaceDemo(mountWorkspace(), { autoplay: false });
		node('calendar').click();
		node('calendar').click();
		expect(heard).toEqual(['calendar']);
	});
});
