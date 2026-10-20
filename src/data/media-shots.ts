// Every photo / video slot on the site, in one list. Until a capture exists a slot
// renders a wireframe placeholder at its final size, so dropping in the real file
// (set `src`, and `poster` for videos) causes no layout shift.
// docs/media-shot-list.md is the capture checklist for this file.

export type MediaRatio = '16/10' | '16/9' | '4/3' | '1/1' | '4/5' | '9/16';

export type MediaShot = {
	id: string;
	kind: 'image' | 'video';
	ratio: MediaRatio;
	/** What the visitor sees: placeholder caption, and the alt text once real media lands. */
	label: string;
	/** What to record, for whoever captures it. */
	capture: string;
	durationSeconds?: number;
	/** File name inside public/assets/ (image, .webm or .mp4). */
	src?: string;
	/** Video poster file name inside public/assets/. */
	poster?: string;
};

export const MEDIA_SHOTS = {
	docs: {
		id: 'docs',
		kind: 'video',
		ratio: '16/10',
		label: 'A page with a linked client, a task list and an embedded board',
		capture: 'Open a page, type /, insert a board, then mention a client from the database.',
		durationSeconds: 8,
	},
	database: {
		id: 'database',
		kind: 'video',
		ratio: '16/10',
		label: 'A client table, filtered and opened as a page',
		capture: 'Filter a clients table by status, then open one row as a full page.',
		durationSeconds: 8,
	},
	board: {
		id: 'board',
		kind: 'video',
		ratio: '16/10',
		label: 'Cards dragged across a board, updating their database rows',
		capture: 'Drag two cards from "In progress" to "Done" on the board view.',
		durationSeconds: 6,
	},
	calendar: {
		id: 'calendar',
		kind: 'video',
		ratio: '16/10',
		label: 'A week calendar showing deadlines pulled from the board',
		capture: 'Week view with board deadlines; drag one event to a new day.',
		durationSeconds: 6,
	},
	mail: {
		id: 'mail',
		kind: 'video',
		ratio: '16/10',
		label: 'An email turned into a task in one step',
		capture: 'Open an email, choose "Create task", and show the new card on the board.',
		durationSeconds: 8,
	},
	whiteboard: {
		id: 'whiteboard',
		kind: 'video',
		ratio: '16/10',
		label: 'A whiteboard sketch dropped into a page',
		capture: 'Sketch a three-step flow on the whiteboard, then embed it in a page.',
		durationSeconds: 8,
	},
	mobile: {
		id: 'mobile',
		kind: 'image',
		ratio: '9/16',
		label: 'The workspace on a phone: today\'s tasks, meetings and inbox',
		capture: 'Phone screenshot (1080x1920) of the home page with tasks, calendar and mail blocks.',
	},
	tablet: {
		id: 'tablet',
		kind: 'image',
		ratio: '4/3',
		label: 'The workspace on a tablet: a launch board with its linked tasks',
		capture: 'Landscape tablet screenshot (2048x1536) of a board view, status bar hidden.',
	},
} as const satisfies Record<string, MediaShot>;

export type MediaShotId = keyof typeof MEDIA_SHOTS;
