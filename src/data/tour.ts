// The 75-second tour (groot docs/redesign/PLAN.md §6.3). Until the recording exists, `ready` is
// false: the dialog and /tour show the chapter list over the poster's placeholder and offer no
// download link that would 404.

export type Chapter = { start: string; key: 'monday' | 'customer' | 'views' | 'learning' | 'sharing' | 'where' };

export const TOUR = {
	ready: false,
	mp4: '/media/tour-1080.mp4',
	webm: '/media/tour-1080.webm',
	poster: '/media/tour-poster.jpg',
	captions: '/media/tour.en.vtt',
	transcript: '/media/tour-transcript.txt',
	width: 1920,
	height: 1080,
} as const;

export const CHAPTERS: readonly Chapter[] = [
	{ start: '0:04', key: 'monday' },
	{ start: '0:16', key: 'customer' },
	{ start: '0:30', key: 'views' },
	{ start: '0:43', key: 'learning' },
	{ start: '0:55', key: 'sharing' },
	{ start: '1:05', key: 'where' },
];
