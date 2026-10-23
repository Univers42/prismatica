// Product facts for the scroll story in the "Inside the studio" section:
// one network joins the shipped database engines, the apps that read that
// data, and the subnetworks (spaces) that decide who reaches what.
// Nothing here touches the DOM — the figure component consumes the layout.

export interface EngineDef {
	id: string;
	label: string;
}

export interface AppDef {
	id: string;
	label: string;
}

export interface SpaceDef {
	id: string;
	label: string;
	engines: string[];
	apps: string[];
}

export interface StepDef {
	id: 'engines' | 'apps' | 'spaces' | 'assistant';
	title: string;
	body: string;
}

export interface NodeLayout {
	id: string;
	label: string;
	x: number;
	y: number;
}

export interface AppLayout extends NodeLayout {
	labelX: number;
	labelY: number;
	anchor: 'start' | 'end' | 'middle';
}

export interface RayLayout {
	id: string;
	d: string;
}

export interface StudioNetworkLayout {
	hub: { x: number; y: number; r: number };
	engines: NodeLayout[];
	apps: AppLayout[];
	engineRays: RayLayout[];
	appRays: RayLayout[];
	orgRing: { r: number; d: string };
}

// Engines shipped today. Exactly these ten.
export const ENGINES: EngineDef[] = [
	{ id: 'postgres', label: 'Postgres' },
	{ id: 'cockroach', label: 'CockroachDB' },
	{ id: 'mongo', label: 'MongoDB' },
	{ id: 'mysql', label: 'MySQL' },
	{ id: 'mariadb', label: 'MariaDB' },
	{ id: 'mssql', label: 'SQL Server' },
	{ id: 'sqlite', label: 'SQLite' },
	{ id: 'redis', label: 'Redis' },
	{ id: 'dynamodb', label: 'DynamoDB' },
	{ id: 'http', label: 'HTTP APIs' },
];

// Apps built on top of the one typed API.
export const APPS: AppDef[] = [
	{ id: 'diagrams', label: 'Diagrams' },
	{ id: 'views', label: 'Views' },
	{ id: 'maps', label: 'Maps' },
	{ id: 'notes', label: 'Notes' },
	{ id: 'trace', label: 'LLM trace' },
];

// Subnetworks. The organisation reaches everything; the pieces below reach
// only what attribute-based access rules let them reach.
export const SPACES: SpaceDef[] = [
	{
		id: 'organisation',
		label: 'Organisation',
		engines: ENGINES.map((engine) => engine.id),
		apps: APPS.map((app) => app.id),
	},
	{
		id: 'team',
		label: 'Sales team',
		engines: ['postgres', 'redis', 'http'],
		apps: ['views', 'maps', 'notes'],
	},
	{
		id: 'public',
		label: 'Public space',
		engines: ['http'],
		apps: ['views', 'notes'],
	},
];

export const STEPS: StepDef[] = [
	{
		id: 'engines',
		title: 'Connect every engine',
		body: 'Ten engines, from Postgres and MongoDB to Redis, DynamoDB and any HTTP API, join one network. Create, read, update and delete through a single typed API.',
	},
	{
		id: 'apps',
		title: 'Build on the same data',
		body: 'Diagrams, views, maps and notes read the live records. The LLM trace draws how a model moves through your data, step by step.',
	},
	{
		id: 'spaces',
		title: 'Decide who reaches what',
		body: 'Organisations, teams and public spaces are subnetworks. Attribute-based rules decide which engines and apps each one can reach.',
	},
	{
		id: 'assistant',
		title: 'Ask for a space',
		body: 'Tell the assistant what your team needs. It lays out the engines, apps and rules, and you adjust the result.',
	},
];

export const ASSISTANT_PROMPT = 'Make a space for the sales team: a pipeline map, shared notes, Postgres and Redis.';

export const ASSISTANT_PICKS = {
	engines: ['postgres', 'redis'],
	apps: ['maps', 'notes'],
};

const round1 = (value: number) => Math.round(value * 10) / 10;

// Lays the network out on a square viewBox of the given size.
// Caveat: the 12° ray bend is tuned for these ring ratios; other hub or ring
// sizes put the beams visibly closer to the nodes than to the labelling.
export function layoutStudioNetwork(size = 640): StudioNetworkLayout {
	const cx = size / 2;
	const cy = size / 2;
	const point = (r: number, deg: number) => {
		const rad = (deg * Math.PI) / 180;
		return { x: round1(cx + r * Math.cos(rad)), y: round1(cy + r * Math.sin(rad)) };
	};
	const beam = (r: number, deg: number) => {
		// Control point sits one 12° step off the node's angle, so rays read as
		// curved beams instead of spokes.
		const from = point(r, deg);
		const ctrl = point(r, deg + 12);
		return `M ${from.x} ${from.y} Q ${ctrl.x} ${ctrl.y} ${round1(cx)} ${round1(cy)}`;
	};
	const engineStep = 360 / ENGINES.length;
	const appStep = 360 / APPS.length;
	const ringR = size * 0.47;
	const hub = { x: round1(cx), y: round1(cy), r: 60 };
	return {
		hub,
		engines: ENGINES.map((engine, i) => ({
			id: engine.id, label: engine.label, ...point(size * 0.4, -90 + i * engineStep),
		})),
		// Apps get their own ring, offset half a step so their labels never sit
		// behind an engine's. Labels sit just outside the ring; the side they
		// hang from follows the app's position so they leave the rays alone.
		apps: APPS.map((app, i) => {
			const angle = -90 + appStep / 2 + i * appStep;
			const cos = Math.cos((angle * Math.PI) / 180);
			const label = point(size * 0.22 + 34, angle);
			return {
				id: app.id,
				label: app.label,
				...point(size * 0.22, angle),
				labelX: label.x,
				labelY: label.y + 7, // + 7 shifts from the ring point to the text baseline
				anchor: cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle',
			};
		}),
		engineRays: ENGINES.map((engine, i) => ({ id: engine.id, d: beam(size * 0.4, -90 + i * engineStep) })),
		appRays: APPS.map((app, i) => ({ id: app.id, d: beam(size * 0.22, -90 + appStep / 2 + i * appStep) })),
		// Spaces are nested (public inside team inside organisation), so they
		// share one boundary ring: a full circle drawn as two half arcs.
		orgRing: {
			r: round1(ringR),
			d: `M ${round1(cx - ringR)} ${round1(cy)} A ${round1(ringR)} ${round1(ringR)} 0 1 1 ${round1(cx + ringR)} ${round1(cy)} A ${round1(ringR)} ${round1(ringR)} 0 1 1 ${round1(cx - ringR)} ${round1(cy)}`,
		},
	};
}
