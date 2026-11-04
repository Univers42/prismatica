// The 75-second tour (groot docs/redesign/PLAN.md §6.3). Until the recording exists, `ready` is
// false: the dialog and /tour show the chapter list over the poster's placeholder and offer no
// download link that would 404.

export type Chapter = { start: string; title: string; caption: string };

export const TOUR = {
	ready: false,
	title: 'One week at Arlet, in 75 seconds',
	mp4: '/media/tour-1080.mp4',
	webm: '/media/tour-1080.webm',
	poster: '/media/tour-poster.jpg',
	captions: '/media/tour.en.vtt',
	transcript: '/media/tour-transcript.txt',
	width: 1920,
	height: 1080,
} as const;

export const CHAPTERS: readonly Chapter[] = [
	{ start: '0:04', title: 'Monday', caption: 'Sales, stock, invoices and coursework on one page.' },
	{ start: '0:16', title: 'One customer', caption: 'Sales, finance and operations read the same record.' },
	{ start: '0:30', title: 'Views', caption: 'The same deals as a table, a board, a calendar and a chart.' },
	{ start: '0:43', title: 'Learning', caption: 'Course notes link to the decision they changed.' },
	{ start: '0:55', title: 'Sharing', caption: 'One page shared with finance, and nothing else.' },
	{ start: '1:05', title: 'Where it runs', caption: 'For a team on grobase, or on your own machine.' },
];
