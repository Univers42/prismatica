// WAI-ARIA tabs: click or arrow keys switch the visible panel. Panels are
// server-rendered; this only flips aria-selected, tabindex and hidden.
// Markup pairs `[role=tab][data-<name>-tab=id]` with
// `[role=tabpanel][data-<name>-panel=id]`, so two tab sets never collide.

export interface Tabs {
	readonly ids: readonly string[];
	select: (id: string) => void;
	selectedIndex: () => number;
}

export type TabChange = (index: number, previous: number) => void;

export function bindTabs(root: HTMLElement, name: string, onChange?: TabChange): Tabs | null {
	const tabAttr = `data-${name}-tab`;
	const panelAttr = `data-${name}-panel`;
	const tabs = [...root.querySelectorAll<HTMLElement>(`[role="tab"][${tabAttr}]`)];
	const panels = [...root.querySelectorAll<HTMLElement>(`[role="tabpanel"][${panelAttr}]`)];
	if (tabs.length === 0 || panels.length !== tabs.length) return null;
	const ids = tabs.map((tab) => tab.getAttribute(tabAttr) ?? '');
	let current = Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));

	// `reveal` scrolls a chip row to the tab the user acted on; a caller that
	// selects from elsewhere (a swipe) must not scroll the page to the tabs.
	function select(index: number, reveal: boolean, focus = false): void {
		const tab = tabs[index];
		if (!tab || index === current) return;
		const previous = current;
		current = index;
		tabs.forEach((candidate, i) => {
			candidate.setAttribute('aria-selected', String(i === index));
			candidate.tabIndex = i === index ? 0 : -1;
		});
		for (const panel of panels) {
			const active = panel.getAttribute(panelAttr) === ids[index];
			panel.hidden = !active;
			panel.classList.toggle('is-entering', active);
		}
		if (focus) tab.focus();
		if (reveal) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		onChange?.(index, previous);
	}

	tabs.forEach((tab, index) => {
		tab.addEventListener('click', () => select(index, true));
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
			select(target, true, true);
		});
	});
	panels.forEach((panel) => panel.addEventListener('animationend', (event) => {
		if (event.target === panel) panel.classList.remove('is-entering');
	}));

	return {
		ids,
		select: (id: string) => select(ids.indexOf(id), false),
		selectedIndex: () => current,
	};
}
