import { afterEach, describe, expect, it } from 'vitest';
import { bindAppTour } from '../../../src/scripts/app-tour';

const IDS = ['docs', 'board', 'mail'];

function mountTour(): HTMLElement {
	document.body.innerHTML = `
		<div data-app-tour>
			<div role="tablist">${IDS.map((id, i) => `<button type="button" role="tab" data-app-tab="${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${id}</button>`).join('')}</div>
			${IDS.map((id, i) => `<div role="tabpanel" data-app-panel="${id}" ${i === 0 ? '' : 'hidden'}></div>`).join('')}
		</div>`;
	return document.querySelector<HTMLElement>('[data-app-tour]')!;
}

const tab = (id: string) => document.querySelector<HTMLButtonElement>(`[data-app-tab="${id}"]`)!;
const panel = (id: string) => document.querySelector<HTMLElement>(`[data-app-panel="${id}"]`)!;

describe('app tour tabs', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('shows the clicked app and keeps exactly one tab selected and tabbable', () => {
		bindAppTour(mountTour());
		tab('board').click();
		expect(panel('board').hidden).toBe(false);
		expect(panel('docs').hidden).toBe(true);
		expect(IDS.filter((id) => tab(id).getAttribute('aria-selected') === 'true')).toEqual(['board']);
		expect(IDS.filter((id) => tab(id).tabIndex === 0)).toEqual(['board']);
	});

	it('moves with arrow keys, wrapping at both ends, and supports Home/End', () => {
		bindAppTour(mountTour());
		tab('docs').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
		expect(panel('mail').hidden).toBe(false);
		expect(document.activeElement).toBe(tab('mail'));

		tab('mail').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		expect(panel('docs').hidden).toBe(false);

		tab('docs').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		expect(panel('mail').hidden).toBe(false);
		tab('mail').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		expect(panel('docs').hidden).toBe(false);
	});

	it('refuses markup where tabs and panels do not pair up', () => {
		const root = mountTour();
		root.querySelector('[data-app-panel="mail"]')!.remove();
		expect(bindAppTour(root)).toBeNull();
	});
});
