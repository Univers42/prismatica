// Hero demo: a workspace page where "/" opens a menu of apps and picking one
// drops it in as a block. It plays itself until the visitor touches it, then
// hands over control. All markup is server-rendered; this only toggles state,
// which keeps it compatible with the page's Trusted Types CSP.

import { motionAllowed } from '../lib/motion-preference';

export type WorkspaceDemoOptions = {
	autoplay?: boolean;
	/** Apps the autoplay cycles through, by id. */
	order?: readonly string[];
	typeDelayMs?: number;
	holdMs?: number;
};

export type WorkspaceDemo = {
	select: (id: string) => void;
	stopAutoplay: () => void;
};

const LEAVE_MS = 220;

export function bindWorkspaceDemo(root: HTMLElement, options: WorkspaceDemoOptions = {}): WorkspaceDemo | null {
	const trigger = root.querySelector<HTMLButtonElement>('[data-workspace-trigger]');
	const typed = root.querySelector<HTMLElement>('[data-workspace-typed]');
	const menu = root.querySelector<HTMLElement>('[data-workspace-menu]');
	const items = [...root.querySelectorAll<HTMLButtonElement>('[data-workspace-item]')];
	const blocks = [...root.querySelectorAll<HTMLElement>('[data-workspace-block]')];
	const nodes = [...root.querySelectorAll<HTMLButtonElement>('[data-workspace-node]')];
	if (!trigger || !typed || !menu || items.length === 0 || blocks.length === 0) return null;

	const typeDelay = options.typeDelayMs ?? 95;
	const hold = options.holdMs ?? 2600;
	const order = options.order ?? items.map((item) => item.dataset.workspaceItem ?? '');
	let current = blocks.find((block) => !block.hidden)?.dataset.workspaceBlock ?? '';
	let autoplaying = options.autoplay ?? motionAllowed();
	let visible = true;
	let timer: number | undefined;
	let menuOpenedByVisitor = false;
	let cursor = Math.max(0, order.indexOf(current));

	const itemFor = (id: string) => items.find((item) => item.dataset.workspaceItem === id);
	const visibleItems = () => items.filter((item) => !item.closest('li')?.hidden);

	// The autoplay "keyboard" highlights the first match; a real visitor's focus
	// ring is the highlight instead, so `highlight` is off for them.
	function filterItems(prefix: string, highlight: boolean): void {
		let first: HTMLButtonElement | undefined;
		for (const item of items) {
			const matches = (item.dataset.command ?? '').startsWith(prefix);
			const row = item.closest('li');
			if (row) row.hidden = !matches;
			item.classList.remove('is-active');
			if (matches && !first) first = item;
		}
		if (highlight) first?.classList.add('is-active');
	}

	function openMenu(prefix: string, byVisitor: boolean): void {
		menu!.hidden = false;
		menuOpenedByVisitor = byVisitor;
		trigger!.setAttribute('aria-expanded', 'true');
		typed!.textContent = `/${prefix}`;
		filterItems(prefix, !byVisitor);
	}

	function closeMenu(): void {
		menu!.hidden = true;
		menuOpenedByVisitor = false;
		trigger!.setAttribute('aria-expanded', 'false');
		typed!.textContent = '';
		filterItems('', false);
	}

	function select(id: string): void {
		const next = blocks.find((block) => block.dataset.workspaceBlock === id);
		if (!next) return;
		items.forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.workspaceItem === id)));
		nodes.forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.workspaceNode === id)));
		if (id === current) return;
		root.dispatchEvent(new CustomEvent('workspace:select', { bubbles: true, detail: { id } }));
		const previous = blocks.find((block) => block.dataset.workspaceBlock === current);
		current = id;
		if (previous) {
			previous.classList.remove('is-entering');
			previous.classList.add('is-leaving');
			window.setTimeout(() => {
				previous.classList.remove('is-leaving');
				if (previous.dataset.workspaceBlock !== current) previous.hidden = true;
			}, LEAVE_MS);
		}
		next.hidden = false;
		next.classList.remove('is-leaving');
		next.classList.add('is-entering');
		// Children animate too and their animationend bubbles; only the block's own ends the entrance.
		const settle = (event: Event): void => {
			if (event.target !== next) return;
			next.classList.remove('is-entering');
			next.removeEventListener('animationend', settle);
		};
		next.addEventListener('animationend', settle);
	}

	function stopAutoplay(): void {
		autoplaying = false;
		window.clearTimeout(timer);
	}

	// One autoplay cycle: type "/", type the command letter by letter (the menu
	// filters as it would for a real keyboard), "press Enter", hold, repeat.
	function playCycle(): void {
		if (!autoplaying || !visible || !motionAllowed()) return;
		cursor = (cursor + 1) % order.length;
		const id = order[cursor] ?? '';
		const command = itemFor(id)?.dataset.command ?? id;
		let typedCount = 0;
		const typeNext = (): void => {
			if (!autoplaying) return;
			openMenu(command.slice(0, typedCount), false);
			if (typedCount < command.length) {
				typedCount += 1;
				timer = window.setTimeout(typeNext, typeDelay);
				return;
			}
			timer = window.setTimeout(() => {
				if (!autoplaying) return;
				closeMenu();
				select(id);
				timer = window.setTimeout(playCycle, hold);
			}, typeDelay * 4);
		};
		timer = window.setTimeout(typeNext, typeDelay * 3);
	}

	function moveFocus(step: number): void {
		const list = visibleItems();
		const index = list.indexOf(document.activeElement as HTMLButtonElement);
		list[(index + step + list.length) % list.length]?.focus();
	}

	// A menu the autoplay left open still opens fully for the visitor, rather
	// than closing under their first tap.
	trigger.addEventListener('click', () => {
		stopAutoplay();
		if (menu.hidden || !menuOpenedByVisitor) {
			openMenu('', true);
			itemFor(current)?.focus();
		} else {
			closeMenu();
		}
	});
	items.forEach((item) => item.addEventListener('click', () => {
		stopAutoplay();
		select(item.dataset.workspaceItem ?? '');
		closeMenu();
		trigger.focus();
	}));
	nodes.forEach((node) => node.addEventListener('click', () => {
		stopAutoplay();
		closeMenu();
		select(node.dataset.workspaceNode ?? '');
	}));
	root.addEventListener('pointerdown', (event) => {
		stopAutoplay();
		const target = event.target as Node;
		if (!menuOpenedByVisitor && !menu.hidden && !menu.contains(target) && !trigger.contains(target)) closeMenu();
	});
	root.addEventListener('focusin', stopAutoplay);
	root.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && !menu.hidden) {
			closeMenu();
			trigger.focus();
		} else if (!menu.hidden && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
			event.preventDefault();
			moveFocus(event.key === 'ArrowDown' ? 1 : -1);
		}
	});
	document.addEventListener('pointerdown', (event) => {
		if (menuOpenedByVisitor && !root.contains(event.target as Node)) closeMenu();
	});

	// Autoplay only while the demo is on screen and the tab is visible;
	// .is-offscreen also parks the CSS loops inside it.
	const setVisible = (value: boolean): void => {
		visible = value;
		root.classList.toggle('is-offscreen', !value);
	};
	const resume = (): void => {
		window.clearTimeout(timer);
		closeMenu();
		timer = window.setTimeout(playCycle, hold / 2);
	};
	if (typeof IntersectionObserver !== 'undefined') {
		new IntersectionObserver(([entry]) => {
			setVisible(Boolean(entry?.isIntersecting));
			if (visible && autoplaying) resume();
			else window.clearTimeout(timer);
		}, { threshold: 0.2 }).observe(root);
	}
	document.addEventListener('visibilitychange', () => {
		setVisible(!document.hidden);
		if (visible && autoplaying) resume();
		else window.clearTimeout(timer);
	});
	if (autoplaying) timer = window.setTimeout(playCycle, hold / 2);

	return { select, stopAutoplay };
}
