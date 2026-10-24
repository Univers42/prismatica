// Light or dark, or no choice at all (follow the OS). One design, two palettes: the five named
// themes of the old site (swiss, aurora, solar, ember, forest) map onto these two so a stored
// choice from before the redesign still means something.
export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_KEY = 'prismatica-theme';

const ORDER: ThemeChoice[] = ['system', 'light', 'dark'];

const LEGACY_THEMES: Readonly<Record<string, ThemeChoice>> = {
	swiss: 'light',
	solar: 'light',
	aurora: 'dark',
	ember: 'dark',
	forest: 'dark',
	night: 'dark',
};

export function normalizeTheme(value: string | null | undefined): ThemeChoice {
	if (value === 'light' || value === 'dark' || value === 'system') return value;
	return (value && LEGACY_THEMES[value]) || 'system';
}

export function nextTheme(current: ThemeChoice): ThemeChoice {
	return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system';
}

export function themeLabel(choice: ThemeChoice): string {
	return { system: 'Match system', light: 'Light', dark: 'Dark' }[choice];
}
