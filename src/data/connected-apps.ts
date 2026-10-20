import { MEDIA_SHOTS, type MediaShot } from './media-shots';

// The apps a workspace page can hold as blocks. The hero's slash menu and the
// app tour both render from this list, so they can never disagree.

export type ConnectedAppId = 'docs' | 'database' | 'board' | 'calendar' | 'mail' | 'whiteboard';

export type ConnectedApp = {
	id: ConnectedAppId;
	name: string;
	/** What the visitor types after "/" in the hero demo. */
	command: string;
	/** One line in the slash menu. */
	hint: string;
	/** The app tour description. */
	summary: string;
	links: readonly ConnectedAppId[];
	shot: MediaShot;
};

export const CONNECTED_APPS: readonly ConnectedApp[] = [
	{
		id: 'docs',
		name: 'Page',
		command: 'page',
		hint: 'Notes, plans and wikis',
		summary: 'Write plans, notes and wikis. Mention a client, a task or an email and it stays linked, wherever it moves.',
		links: ['database', 'board', 'mail'],
		shot: MEDIA_SHOTS.docs,
	},
	{
		id: 'database',
		name: 'Database',
		command: 'database',
		hint: 'Clients, orders, stock',
		summary: 'Keep clients, orders or stock in tables. Every row opens as a page, and every view reads the same data.',
		links: ['board', 'calendar', 'docs'],
		shot: MEDIA_SHOTS.database,
	},
	{
		id: 'board',
		name: 'Board',
		command: 'board',
		hint: 'Work moving through stages',
		summary: 'Move work across stages. Cards are rows of your database, not copies, so nothing goes stale.',
		links: ['database', 'calendar'],
		shot: MEDIA_SHOTS.board,
	},
	{
		id: 'calendar',
		name: 'Calendar',
		command: 'calendar',
		hint: 'Deadlines and meetings',
		summary: 'See deadlines and meetings in one week. Dates come straight from your boards and your mail.',
		links: ['board', 'mail'],
		shot: MEDIA_SHOTS.calendar,
	},
	{
		id: 'mail',
		name: 'Mail',
		command: 'mail',
		hint: 'Your inbox, next to the work',
		summary: 'Read mail next to the work it is about. Turn any email into a task in one step.',
		links: ['board', 'docs'],
		shot: MEDIA_SHOTS.mail,
	},
	{
		id: 'whiteboard',
		name: 'Whiteboard',
		command: 'whiteboard',
		hint: 'Sketch flows and ideas',
		summary: 'Sketch flows and ideas together, then drop the drawing into any page.',
		links: ['docs'],
		shot: MEDIA_SHOTS.whiteboard,
	},
];

export function appName(id: ConnectedAppId): string {
	return CONNECTED_APPS.find((app) => app.id === id)?.name ?? id;
}
