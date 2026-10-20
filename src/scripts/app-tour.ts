// WAI-ARIA tabs for the app tour: click or arrow keys switch the visible app.
// Panels are server-rendered; this only flips aria-selected / hidden.

export function bindAppTour(root: HTMLElement): { select: (id: string) => void } | null {
	const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"][data-app-tab]')];
	const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"][data-app-panel]')];
	if (tabs.length === 0 || panels.length !== tabs.length) return null;

	function select(id: string, focus = false): void {
		const tab = tabs.find((candidate) => candidate.dataset.appTab === id);
		if (!tab || tab.getAttribute('aria-selected') === 'true') return;
		for (const candidate of tabs) {
			const selected = candidate === tab;
			candidate.setAttribute('aria-selected', String(selected));
			candidate.tabIndex = selected ? 0 : -1;
		}
		for (const panel of panels) {
			const active = panel.dataset.appPanel === id;
			panel.hidden = !active;
			panel.classList.toggle('is-entering', active);
		}
		if (focus) tab.focus();
		tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	tabs.forEach((tab, index) => {
		tab.addEventListener('click', () => select(tab.dataset.appTab ?? ''));
		tab.addEventListener('keydown', (event) => {
			const last = tabs.length - 1;
			const target = {
				ArrowRight: index === last ? 0 : index + 1,
				ArrowDown: index === last ? 0 : index + 1,
				ArrowLeft: index === 0 ? last : index - 1,
				ArrowUp: index === 0 ? last : index - 1,
				Home: 0,
				End: last,
			}[event.key];
			if (target === undefined) return;
			event.preventDefault();
			select(tabs[target]?.dataset.appTab ?? '', true);
		});
	});
	panels.forEach((panel) => panel.addEventListener('animationend', (event) => {
		if (event.target === panel) panel.classList.remove('is-entering');
	}));

	return { select: (id: string) => select(id) };
}
