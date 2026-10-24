// Where the site sends people, in one place. The desktop release is the one that exists today
// (groot docs/redesign/DECISIONS.md D-031): its app needs the lean Docker backend from the source
// on the same machine (apps/osionos-electron/local-edition/README.md). Update RELEASE when a newer
// local edition is published, and never name a platform it does not ship for.

export const NAV = [
	{ href: '/#product', label: 'Product' },
	{ href: '/docs/', label: 'Docs' },
	{ href: '/#run', label: 'Run locally' },
] as const;

export const SOURCE_URL = 'https://github.com/Univers42/groot';

export const RELEASE = {
	tag: 'osionos-v0.5.2-local',
	url: 'https://github.com/Univers42/groot/releases/tag/osionos-v0.5.2-local',
	platforms: 'Linux (AppImage, .deb) and Windows (.exe)',
	backend: 'Docker',
	engine: 'PostgreSQL',
} as const;
