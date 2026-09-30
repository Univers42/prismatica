export type ThemeName = 'swiss' | 'aurora' | 'solar' | 'ember' | 'forest';

export const THEMES: ThemeName[] = ['swiss', 'aurora', 'solar', 'ember', 'forest'];

export function isThemeName(value: string | null | undefined): value is ThemeName {
	return value === 'swiss' || value === 'aurora' || value === 'solar' || value === 'ember' || value === 'forest';
}

export function normalizeTheme(value: string | null): ThemeName | null {
	if (isThemeName(value)) {
		return value;
	}
	if (value === 'light') {
		return 'swiss';
	}
	if (value === 'dark' || value === 'night') {
		return 'aurora';
	}
	return null;
}

export function themeIcon(theme: ThemeName): string {
	const icons: Record<ThemeName, string> = {
		swiss: '▦',
		aurora: '✦',
		solar: '☼',
		ember: '◒',
		forest: '◆',
	};
	return icons[theme];
}

export function themeDisplayName(theme: ThemeName): string {
	const labels: Record<ThemeName, string> = {
		swiss: 'Swiss',
		aurora: 'Aurora',
		solar: 'Solar',
		ember: 'Ember',
		forest: 'Forest',
	};
	return labels[theme];
}
