// Every product capture the site shows, keyed by the shot id of groot's docs/redesign/PLAN.md
// §6.1. The captures come from the demo account (groot scripts/media/capture.ts); until a shot
// is captured, `ready` is false and CaptureFrame draws a labelled placeholder of the same size,
// so the layout and CLS are final before the media lands. Alt text says what is on screen.

export type ShotId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9' | 'S10' | 'S11' | 'S12';

export type Shot = {
	id: ShotId;
	title: string;
	alt: string;
	width: number;
	height: number;
	ready: boolean;
};

const desktop = { width: 1440, height: 900 } as const;

export const SHOTS: Record<ShotId, Shot> = {
	S1: { id: 'S1', ...desktop, ready: false, title: 'Home dashboard', alt: "Inès's Monday in Prismatica: this week's meetings, open deals, items below their reorder point, unpaid invoices and this week's coursework on one page." },
	S2: { id: 'S2', ...desktop, ready: false, title: 'Contact page', alt: 'The contact page of Marc Delorme, buyer at Hôtel Varenne, with his company, three deals, seven invoices, call notes and a linked lecture note.' },
	S3: { id: 'S3', ...desktop, ready: false, title: 'Company page', alt: 'The company page of Hôtel Varenne, listing four contacts with their roles and a rollup of its deals.' },
	S4: { id: 'S4', ...desktop, ready: false, title: 'Deals board', alt: 'The deals database as a board, one column per pipeline stage from lead to won and lost.' },
	S5: { id: 'S5', ...desktop, ready: false, title: 'Deals table', alt: 'The same deals as a table, in a saved view filtered to open deals over €5,000 and sorted by owner.' },
	S6: { id: 'S6', ...desktop, ready: false, title: 'Interactions calendar', alt: 'Calls and meetings with clients on a month calendar.' },
	S7: { id: 'S7', ...desktop, ready: false, title: 'Revenue chart', alt: 'Monthly revenue over eighteen months as a chart, with two weak months visible.' },
	S8: { id: 'S8', ...desktop, ready: false, title: 'Academy note', alt: 'A course note on dual sourcing, with backlinks to a book, a guest lecturer and the supplier decision it informed.' },
	S9: { id: 'S9', ...desktop, ready: false, title: 'Graph view', alt: 'A graph of notes, decisions and records, centred on the supplier-switch decision.' },
	S10: { id: 'S10', ...desktop, ready: false, title: 'Library', alt: 'Books and papers as cards in a gallery, each with its tags.' },
	S11: { id: 'S11', ...desktop, ready: false, title: "Jules's view", alt: 'Signed in as Jules from finance: the one page Inès shared with him, and none of her other pages or databases.' },
	S12: { id: 'S12', ...desktop, ready: false, title: 'Tour poster', alt: 'The home dashboard, with a play button for the 75-second tour.' },
};
