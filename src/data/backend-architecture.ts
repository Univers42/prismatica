export type ServiceCategory = 'core' | 'auth' | 'data' | 'engagement' | 'ai' | 'compliance' | 'ops';

export interface ServiceDef {
	id: string;
	name: string;
	category: ServiceCategory;
	required?: boolean;
	desc: string;
	cost: number;
	latencyMs: number;
	gdprPoints: number;
	risk: number;
	complexity: number;
}

export interface Preset {
	id: string;
	label: string;
	enabled: string[];
}

export interface NodePosition {
	x: number;
	y: number;
	w: number;
	h: number;
}

export const SERVICES: ServiceDef[] = [
	{ id: 'kong',         name: 'Kong gateway',     category: 'core',       required: true, desc: 'Edge routing, JWT, rate-limit.',           cost: 0,  latencyMs: 4, gdprPoints: 1, risk: 1, complexity: 1 },
	{ id: 'postgres',     name: 'Postgres',         category: 'core',       required: true, desc: 'Primary relational store, RLS.',          cost: 12, latencyMs: 6, gdprPoints: 2, risk: 2, complexity: 1 },
	{ id: 'session',      name: 'Sessions',         category: 'auth',                       desc: 'Login, refresh, magic-link, MFA.',         cost: 4,  latencyMs: 8, gdprPoints: 1, risk: 2, complexity: 2 },
	{ id: 'permission',   name: 'Permissions',      category: 'auth',                       desc: 'RBAC + ABAC policy engine.',              cost: 4,  latencyMs: 5, gdprPoints: 1, risk: 1, complexity: 2 },
	{ id: 'schema',       name: 'Schema service',   category: 'data',                       desc: 'Migrations, typed schemas.',               cost: 3,  latencyMs: 0, gdprPoints: 0, risk: 1, complexity: 1 },
	{ id: 'query',        name: 'Query router',     category: 'data',                       desc: 'PostgREST + Mongo planner.',              cost: 5,  latencyMs: 6, gdprPoints: 0, risk: 2, complexity: 2 },
	{ id: 'mongo',        name: 'MongoDB',          category: 'data',                       desc: 'Document store.',                          cost: 9,  latencyMs: 7, gdprPoints: 1, risk: 2, complexity: 2 },
	{ id: 'storage',      name: 'Storage',          category: 'data',                       desc: 'S3-compatible objects + presign.',        cost: 6,  latencyMs: 4, gdprPoints: 1, risk: 1, complexity: 1 },
	{ id: 'email',        name: 'Email',            category: 'engagement',                 desc: 'Transactional mail + DKIM.',              cost: 3,  latencyMs: 0, gdprPoints: 1, risk: 1, complexity: 1 },
	{ id: 'newsletter',   name: 'Newsletter',       category: 'engagement',                 desc: 'Subscriptions + campaigns.',              cost: 2,  latencyMs: 0, gdprPoints: 1, risk: 1, complexity: 1 },
	{ id: 'analytics',    name: 'Analytics',        category: 'engagement',                 desc: 'Cookieless events + funnels.',            cost: 4,  latencyMs: 0, gdprPoints: 0, risk: 1, complexity: 1 },
	{ id: 'ai',           name: 'AI',               category: 'ai',                          desc: 'Chat, completions, prompt vault.',        cost: 18, latencyMs: 0, gdprPoints: 0, risk: 2, complexity: 3 },
	{ id: 'gdpr',         name: 'GDPR',             category: 'compliance',                  desc: 'Consent, exports, deletion runbook.',     cost: 2,  latencyMs: 0, gdprPoints: 4, risk: 0, complexity: 1 },
	{ id: 'logs',         name: 'Logs',             category: 'ops',                         desc: 'Buffered structured logs + retention.',   cost: 3,  latencyMs: 0, gdprPoints: 1, risk: 1, complexity: 1 },
	{ id: 'adapter',      name: 'Adapters',         category: 'ops',                         desc: 'Plug new DBs/secrets without redeploy.',  cost: 1,  latencyMs: 1, gdprPoints: 0, risk: 0, complexity: 1 },
];

export const PRESETS: Preset[] = [
	{ id: 'minimal',    label: 'Solo / MVP',    enabled: ['kong', 'postgres', 'session', 'schema', 'query', 'email', 'gdpr'] },
	{ id: 'startup',    label: 'Startup',       enabled: ['kong', 'postgres', 'session', 'permission', 'schema', 'query', 'storage', 'email', 'analytics', 'gdpr', 'logs'] },
	{ id: 'scaleup',    label: 'Scale-up',      enabled: ['kong', 'postgres', 'mongo', 'session', 'permission', 'schema', 'query', 'storage', 'email', 'newsletter', 'analytics', 'ai', 'gdpr', 'logs', 'adapter'] },
	{ id: 'compliance', label: 'Regulated EU',  enabled: ['kong', 'postgres', 'session', 'permission', 'schema', 'query', 'storage', 'email', 'gdpr', 'logs'] },
];

export const EDGES: Array<[string, string]> = [
	['kong', 'session'], ['kong', 'permission'], ['kong', 'query'],
	['kong', 'storage'], ['kong', 'email'], ['kong', 'newsletter'],
	['kong', 'analytics'], ['kong', 'ai'], ['kong', 'gdpr'],
	['session', 'postgres'], ['permission', 'postgres'],
	['schema', 'postgres'], ['schema', 'mongo'],
	['query', 'postgres'], ['query', 'mongo'],
	['storage', 'adapter'],
	['email', 'logs'],
	['newsletter', 'postgres'], ['analytics', 'postgres'],
	['ai', 'postgres'], ['gdpr', 'postgres'], ['gdpr', 'logs'],
	['logs', 'postgres'],
	['adapter', 'postgres'], ['adapter', 'mongo'],
];

export const NODE_POSITIONS: Record<string, NodePosition> = {
	kong:       { x:  40, y: 270, w: 170, h: 80 },
	session:    { x: 270, y:  40, w: 170, h: 70 },
	permission: { x: 270, y: 130, w: 170, h: 70 },
	query:      { x: 270, y: 220, w: 170, h: 70 },
	schema:     { x: 270, y: 310, w: 170, h: 70 },
	storage:    { x: 270, y: 400, w: 170, h: 70 },
	email:      { x: 270, y: 490, w: 170, h: 70 },
	newsletter: { x: 510, y:  40, w: 170, h: 70 },
	analytics:  { x: 510, y: 130, w: 170, h: 70 },
	adapter:    { x: 510, y: 220, w: 170, h: 70 },
	logs:       { x: 510, y: 310, w: 170, h: 70 },
	gdpr:       { x: 510, y: 400, w: 170, h: 70 },
	ai:         { x: 510, y: 490, w: 170, h: 70 },
	postgres:   { x: 760, y: 170, w: 220, h: 100 },
	mongo:      { x: 760, y: 340, w: 220, h: 100 },
};

export function getNodeCenter(id: string): { cx: number; cy: number } {
	const pos = NODE_POSITIONS[id] ?? { x: 0, y: 0, w: 0, h: 0 };
	return { cx: pos.x + pos.w / 2, cy: pos.y + pos.h / 2 };
}
