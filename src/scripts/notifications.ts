/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   notifications.ts                                   :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/18 21:19:16 by dlesieur          #+#    #+#             */
/*   Updated: 2026/05/18 21:19:16 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

export type NotificationKind = 'success' | 'error' | 'warning' | 'info';

export type NotificationOptions = {
	kind: NotificationKind;
	title: string;
	message?: string;
	duration?: number;
	id?: string;
};

type NotificationRecord = {
	id: string;
	element: HTMLElement;
	timer: ReturnType<typeof setTimeout> | undefined;
};

const DEFAULT_DURATIONS: Record<NotificationKind, number> = {
	success: 4000,
	error: 8000,
	warning: 6000,
	info: 5000,
};

// Drawn as SVG paths: the text glyphs (✓ ✕ ⚠ ℹ) are missing from the site fonts and rendered as boxes.
const ICON_PATHS: Record<NotificationKind, string> = {
	success: 'M20 6 9 17l-5-5',
	error: 'M18 6 6 18M6 6l12 12',
	warning: 'M12 6v8M12 18h.01',
	info: 'M12 11v7M12 6h.01',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const records = new Map<string, NotificationRecord>();
let counter = 0;
let escapeListenerBound = false;

function ensureNotificationRoot(): HTMLElement {
	const existingRoot = document.querySelector('#notification-root');
	if (existingRoot instanceof HTMLElement) {
		if (!escapeListenerBound) {
			document.addEventListener('keydown', (event) => {
				if (event.key !== 'Escape') {
					return;
				}
				const topmost = Array.from(records.values()).at(-1);
				if (topmost) {
					dismissNotification(topmost.id);
				}
			});
			escapeListenerBound = true;
		}
		return existingRoot;
	}
	const root = document.createElement('div');
	root.id = 'notification-root';
	root.className = 'notification-root';
	root.setAttribute('aria-live', 'polite');
	root.setAttribute('aria-atomic', 'false');
	document.body.prepend(root);
	if (!escapeListenerBound) {
		document.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') {
				return;
			}
			const topmost = Array.from(records.values()).at(-1);
			if (topmost) {
				dismissNotification(topmost.id);
			}
		});
		escapeListenerBound = true;
	}
	return root;
}

function createNotificationId(options: NotificationOptions): string {
	if (options.id) {
		return options.id;
	}
	counter += 1;
	return `notification-${Date.now()}-${counter}`;
}

function createTextElement(tagName: 'p' | 'strong' | 'span', className: string, text: string): HTMLElement {
	const element = document.createElement(tagName);
	element.className = className;
	element.textContent = text;
	return element;
}

function createIcon(kind: NotificationKind): HTMLElement {
	const icon = document.createElement('span');
	icon.className = 'notification-card__icon';
	icon.setAttribute('aria-hidden', 'true');
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('focusable', 'false');
	const path = document.createElementNS(SVG_NS, 'path');
	path.setAttribute('d', ICON_PATHS[kind]);
	svg.append(path);
	icon.append(svg);
	return icon;
}

function createDismissProgress(duration: number): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.classList.add('notification-card__dismiss-progress');
	svg.setAttribute('viewBox', '0 0 36 36');
	svg.setAttribute('aria-hidden', 'true');
	svg.style.setProperty('--notification-duration', `${duration}ms`);
	const track = document.createElementNS(SVG_NS, 'circle');
	track.classList.add('notification-card__dismiss-progress-track');
	const ring = document.createElementNS(SVG_NS, 'circle');
	ring.classList.add('notification-card__dismiss-progress-ring');
	[track, ring].forEach((circle) => {
		circle.setAttribute('cx', '18');
		circle.setAttribute('cy', '18');
		circle.setAttribute('r', '15.5');
	});
	svg.append(track, ring);
	return svg;
}

function removeRecord(id: string): void {
	const record = records.get(id);
	if (!record) {
		return;
	}
	if (record.timer !== undefined) {
		globalThis.clearTimeout(record.timer);
	}
	records.delete(id);
	record.element.remove();
}

export function dismissNotification(id: string): void {
	const record = records.get(id);
	if (!record) {
		return;
	}
	if (record.timer !== undefined) {
		globalThis.clearTimeout(record.timer);
	}
	record.element.classList.add('notification-card--leaving');
	globalThis.setTimeout(() => removeRecord(id), 180);
}

export function dismissAll(): void {
	Array.from(records.keys()).forEach((id) => dismissNotification(id));
}

export function notify(options: NotificationOptions): void {
	const root = ensureNotificationRoot();
	const id = createNotificationId(options);
	if (records.has(id)) {
		dismissNotification(id);
	}

	const duration = options.duration ?? DEFAULT_DURATIONS[options.kind];
	const card = document.createElement('article');
	card.className = `notification-card notification-card--${options.kind}`;
	card.dataset.notificationId = id;
	card.setAttribute('role', options.kind === 'error' || options.kind === 'warning' ? 'alert' : 'status');
	card.setAttribute('aria-atomic', 'true');

	const icon = createIcon(options.kind);

	const body = document.createElement('div');
	body.className = 'notification-card__body';
	body.append(createTextElement('strong', 'notification-card__title', options.title));
	if (options.message) {
		body.append(createTextElement('p', 'notification-card__message', options.message));
	}

	const dismiss = document.createElement('button');
	dismiss.className = 'notification-card__dismiss';
	dismiss.type = 'button';
	dismiss.setAttribute('aria-label', `Dismiss ${options.title}`);
	dismiss.addEventListener('click', () => dismissNotification(id));
	const dismissLabel = createTextElement('span', 'notification-card__dismiss-label', '×');
	if (duration > 0) {
		dismiss.classList.add('notification-card__dismiss--timed');
		dismiss.append(createDismissProgress(duration), dismissLabel);
	} else {
		dismiss.append(dismissLabel);
	}

	card.append(icon, body, dismiss);

	root.append(card);
	const timer = duration > 0 ? globalThis.setTimeout(() => dismissNotification(id), duration) : undefined;
	records.set(id, { id, element: card, timer });
}

declare global {
	interface Window {
		PrismaticaNotifications?: {
			notify: typeof notify;
			dismissNotification: typeof dismissNotification;
			dismissAll: typeof dismissAll;
		};
	}
}

if (globalThis.window !== undefined) {
	globalThis.window.PrismaticaNotifications = { notify, dismissNotification, dismissAll };
}
