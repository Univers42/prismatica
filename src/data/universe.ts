import type { ConnectedAppId } from './connected-apps';

// The hero's sky: everyday business items, each living in one app and linked
// to items in other apps. Where each node sits is CSS (HeroUniverse.astro);
// this file is only who exists and who links to whom.

export type UniverseNode = {
	id: string;
	label: string;
	app: ConnectedAppId;
	/** People show initials instead of their app's icon. */
	initials?: string;
	/** Hidden below 640px, where the sky has room for eight. */
	wideOnly?: boolean;
};

export const UNIVERSE_NODES: readonly UniverseNode[] = [
	{ id: 'acme', label: 'Acme Co', app: 'database' },
	{ id: 'quote', label: 'Revised quote', app: 'mail' },
	{ id: 'ines', label: 'Ines Arlet', app: 'mail', initials: 'IA' },
	{ id: 'invoice', label: 'Invoice 204', app: 'database' },
	{ id: 'pricing', label: 'Q4 pricing', app: 'docs', wideOnly: true },
	{ id: 'northwind', label: 'Northwind', app: 'database', wideOnly: true },
	{ id: 'landing', label: 'Landing copy', app: 'board' },
	{ id: 'contract', label: 'Contract review', app: 'board', wideOnly: true },
	{ id: 'launch', label: 'Launch, Oct 24', app: 'calendar' },
	{ id: 'kickoff', label: 'Kickoff call', app: 'calendar', wideOnly: true },
	{ id: 'plan', label: 'Launch plan', app: 'docs' },
	{ id: 'flow', label: 'Signup flow', app: 'whiteboard' },
];

export const UNIVERSE_LINKS: readonly (readonly [string, string])[] = [
	['acme', 'quote'],
	['acme', 'invoice'],
	['ines', 'quote'],
	['quote', 'landing'],
	['quote', 'pricing'],
	['pricing', 'acme'],
	['invoice', 'contract'],
	['northwind', 'contract'],
	['northwind', 'kickoff'],
	['landing', 'launch'],
	['launch', 'plan'],
	['kickoff', 'plan'],
	['plan', 'flow'],
	['ines', 'invoice'],
	['flow', 'landing'],
];
