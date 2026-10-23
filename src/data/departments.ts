// The six departments of the story and their illustration-only hues (PLAN §2.1). The hues are
// drawn as SVG paint attributes in Convergence and Silo, never as site tokens, so they cannot
// leak into text, states or backgrounds.

export type Department = { name: string; hue: string };

export const DEPARTMENTS = [
	{ name: 'Sales', hue: '#e4572e' },
	{ name: 'Finance', hue: '#d99a0b' },
	{ name: 'Operations', hue: '#29a36a' },
	{ name: 'Service', hue: '#2e86ab' },
	{ name: 'Learning', hue: '#7b5ea7' },
	{ name: 'Library', hue: '#c2185b' },
] as const satisfies readonly Department[];

export function department(name: (typeof DEPARTMENTS)[number]['name']): Department {
	return DEPARTMENTS.find((d) => d.name === name) ?? DEPARTMENTS[0];
}
