import { afterEach, describe, expect, it } from 'vitest';
import { dismissAll, notify } from '../../../src/scripts/notifications';

// ARIA in HTML: <article> admits only application, document, feed, main, none, presentation and
// region, so an article with role="alert" or "status" is an invalid role (axe aria-allowed-role,
// measured on /auth/* by Lighthouse 2026-10-15). A <div> admits every role.
describe('notification cards', () => {
	afterEach(() => {
		dismissAll();
		document.body.replaceChildren();
	});

	it.each([
		['error', 'alert'],
		['warning', 'alert'],
		['success', 'status'],
		['info', 'status'],
	] as const)('a %s card is a live region on an element that admits role="%s"', (kind, role) => {
		notify({ kind, title: `${kind} title`, message: 'message' });
		const card = document.querySelector(`.notification-card--${kind}`);
		expect(card?.getAttribute('role')).toBe(role);
		expect(card?.tagName).toBe('DIV');
	});
});
