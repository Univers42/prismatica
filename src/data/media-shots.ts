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
	/** Half-width copy of an image `src`, served to narrow screens. */
	srcSmall?: string;
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
		kind: 'image',
		ratio: '16/10',
		label: 'SQLite, SQL Server, DynamoDB, MongoDB, MySQL and PostgreSQL databases in one sidebar, with a PostgreSQL orders table open',
		capture: 'Laptop (1440x900 @2x): Databases sidebar expanded, pg-commerce orders in the Table view.',
		src: 'osionos-database.webp',
		srcSmall: 'osionos-database-800.webp',
	},
	board: {
		id: 'board',
		kind: 'image',
		ratio: '16/10',
		label: 'A tasks board with cards grouped by status, each card a row of the tasks database',
		capture: 'Laptop (1440x900 @2x): Tasks board, sidebar collapsed.',
		src: 'osionos-board.webp',
		srcSmall: 'osionos-board-800.webp',
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
		label: 'The workspace on a tablet: revenue by order status, read live from PostgreSQL',
		capture: 'Landscape tablet (1024x768 @2x): pg-commerce orders, "Revenue by Status" chart view.',
		src: 'osionos-tablet.webp',
		srcSmall: 'osionos-tablet-800.webp',
	},
	dashboard: {
		id: 'dashboard',
		kind: 'image',
		ratio: '16/10',
		label: 'A product dashboard with totals, a category bar, a category donut and shipping methods, beside the databases it reads',
		capture: 'Laptop (1440x900 @2x): Products overview dashboard, Databases sidebar expanded.',
		src: 'osionos-dashboard.webp',
		srcSmall: 'osionos-dashboard-800.webp',
	},
	analytics: {
		id: 'analytics',
		kind: 'image',
		ratio: '16/10',
		label: 'The product analytics view in the dark Midnight theme: four totals, a category breakdown and a shipping donut',
		capture: 'Laptop (1440x900 @2x): Products analytics dashboard, Midnight theme, dark mode.',
		src: 'osionos-analytics.webp',
		srcSmall: 'osionos-analytics-800.webp',
	},
	map: {
		id: 'map',
		kind: 'image',
		ratio: '16/10',
		label: 'A world map with one pin per product warehouse, coloured by category, and the list of locations beside it',
		capture: 'Laptop (1440x900 @2x): Products warehouse map view.',
		src: 'osionos-map.webp',
		srcSmall: 'osionos-map-800.webp',
	},
	timeline: {
		id: 'timeline',
		kind: 'image',
		ratio: '16/10',
		label: 'Eight projects drawn as bars on a month timeline, each labelled with its status',
		capture: 'Laptop (1440x900 @2x): Projects timeline, month scale, Feb to Aug 2026.',
		src: 'osionos-timeline.webp',
		srcSmall: 'osionos-timeline-800.webp',
	},
	split: {
		id: 'split',
		kind: 'image',
		ratio: '16/10',
		label: 'The editor split in two: a tasks board on the left, the product analytics on the right, in the Midnight theme',
		capture: 'Laptop (1440x900 @2x): Split right, Tasks board left, Products analytics right.',
		src: 'osionos-split.webp',
		srcSmall: 'osionos-split-800.webp',
	},
	themes: {
		id: 'themes',
		kind: 'image',
		ratio: '16/10',
		label: 'The preferences window listing colour themes: High Contrast, Maximal, Nord, Solarized, Midnight, Rosé Pine and Ember',
		capture: 'Laptop (1440x900 @2x): Settings, Preferences, colour theme list, dark mode.',
		src: 'osionos-themes.webp',
		srcSmall: 'osionos-themes-800.webp',
	},
	crmDeals: {
		id: 'crmDeals',
		kind: 'image',
		ratio: '16/10',
		label: 'A Deals table for a sales CRM: stage, amount, probability, a weighted-value formula, a health formula, owner, company and region; won deals are green, lost deals red, likely deals blue',
		capture: 'Laptop (1440x900 @2x): Northwind CRM, Deals, "All deals" table view with its colour rules.',
		src: 'osionos-crm-deals.webp',
		srcSmall: 'osionos-crm-deals-800.webp',
	},
	crmCalendar: {
		id: 'crmCalendar',
		kind: 'image',
		ratio: '16/10',
		label: 'November 2026 in a calendar view of the same deals, each next step on its date and coloured by stage',
		capture: 'Laptop (1440x900 @2x): Deals, "Next steps" calendar view, month scale.',
		src: 'osionos-crm-calendar.webp',
		srcSmall: 'osionos-crm-calendar-800.webp',
	},
	crmGallery: {
		id: 'crmGallery',
		kind: 'image',
		ratio: '16/10',
		label: 'Deals worth more than 60,000 as gallery cards showing company, amount, stage and owner',
		capture: 'Laptop (1440x900 @2x): Deals, "Big tickets" gallery view, filtered on amount.',
		src: 'osionos-crm-gallery.webp',
		srcSmall: 'osionos-crm-gallery-800.webp',
	},
	crmPipeline: {
		id: 'crmPipeline',
		kind: 'image',
		ratio: '16/10',
		label: 'The same deals as a pipeline board, one column per stage from Lead to Won, each card showing amount, owner, close date and products',
		capture: 'Laptop (1440x900 @2x): Deals, "Pipeline" board view grouped by stage.',
		src: 'osionos-crm-pipeline.webp',
		srcSmall: 'osionos-crm-pipeline-800.webp',
	},
	crmForecast: {
		id: 'crmForecast',
		kind: 'image',
		ratio: '16/10',
		label: 'A forecast dashboard over the deals: closing this quarter, deals over 60,000, the largest open deal and average win odds, with accounts on a world map coloured by stage and a donut of deals by region',
		capture: 'Laptop (1440x900 @2x): Deals, "Forecast & regions" dashboard view.',
		src: 'osionos-crm-forecast.webp',
		srcSmall: 'osionos-crm-forecast-800.webp',
	},
} as const satisfies Record<string, MediaShot>;

export type MediaShotId = keyof typeof MEDIA_SHOTS;
