// The "Views, not copies" tablist (WAI-ARIA tabs, automatic activation): arrow keys, Home and End
// move between tabs, and the capture swaps through a View Transition unless motion is reduced.
// Without this script the four panels simply stack, each under its own heading.

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

function selectTab(tabs: HTMLButtonElement[], panels: HTMLElement[], next: HTMLButtonElement): void {
	const swap = (): void => {
		tabs.forEach((tab) => {
			const selected = tab === next;
			tab.setAttribute('aria-selected', String(selected));
			tab.tabIndex = selected ? 0 : -1;
		});
		const target = next.getAttribute('aria-controls');
		panels.forEach((panel) => {
			if (panel.id === target) panel.dataset.active = '';
			else delete panel.dataset.active;
		});
	};
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const doc = document as ViewTransitionDocument;
	if (doc.startViewTransition && !reduced) doc.startViewTransition(swap);
	else swap();
}

function neighbour(tabs: HTMLButtonElement[], current: number, key: string): HTMLButtonElement | null {
	const last = tabs.length - 1;
	const index = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: last }[key];
	if (index === undefined) return null;
	return tabs[(index + tabs.length) % tabs.length] ?? null;
}

export function bindViewTabs(root: ParentNode = document): void {
	root.querySelectorAll<HTMLElement>('[data-views]').forEach((views) => {
		const tabs = Array.from(views.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
		const panels = Array.from(views.querySelectorAll<HTMLElement>('[data-view-panel]'));
		panels.forEach((panel) => {
			panel.setAttribute('role', 'tabpanel');
			const tab = tabs.find((t) => t.getAttribute('aria-controls') === panel.id);
			if (tab) panel.setAttribute('aria-labelledby', tab.id);
		});
		tabs.forEach((tab, i) => {
			tab.addEventListener('click', () => selectTab(tabs, panels, tab));
			tab.addEventListener('keydown', (event) => {
				const next = neighbour(tabs, i, event.key);
				if (!next) return;
				event.preventDefault();
				next.focus();
				selectTab(tabs, panels, next);
			});
		});
	});
}
