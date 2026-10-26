// One line per page section: the dock speaks whichever section sits in the
// reading band, instead of cycling a fixed tip list on a timer.
export const MASCOT_LINES: ReadonlyArray<{ section: string; line: string }> = [
	{ section: 'apps', line: 'Pick the apps your team uses. I link them on one page.' },
	{ section: 'product', line: 'Mail, calendar and boards, linked on one page.' },
	{ section: 'canvas', line: 'Every window on the canvas is a live view of your workspace.' },
	{ section: 'architecture', line: 'Ask me for a space and I lay out the engines, apps and rules.' },
	{ section: 'pricing', line: 'Start free, or self-host the whole workspace with one command.' },
	{ section: 'docs', line: 'Postgres plus PostgREST gives you a typed API.' },
	{ section: 'faq', line: 'Your data stays on your own machine.' },
];

export const ASSISTANT_PROMPT_LINE = 'Try asking: make a space for the sales team.';

// Fired by the studio story whenever its active step changes.
export const STUDIO_STEP_EVENT = 'prismatica:studio-step';
