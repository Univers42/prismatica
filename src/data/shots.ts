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
	S1: { id: 'S1', ...desktop, ready: true, title: 'Operations home', alt: "The Arlet operations home page in Prismatica: four pinned hubs (the supplier switch, the stock-reorder rule, the Hôtel Varenne framework contract and Inès's executive certificate) and every page that links back to it." },
	S2: { id: 'S2', ...desktop, ready: false, title: 'Contact page', alt: 'The contact page of Marc Delorme, buyer at Hôtel Varenne, with his company, three deals, seven invoices, call notes and a linked lecture note.' },
	S3: { id: 'S3', ...desktop, ready: false, title: 'Company page', alt: 'The company page of Hôtel Varenne, listing four contacts with their roles and a rollup of its deals.' },
	S4: { id: 'S4', ...desktop, ready: false, title: 'Deals board', alt: 'The deals database as a board, one column per pipeline stage from lead to won and lost.' },
	S5: { id: 'S5', ...desktop, ready: false, title: 'Deals table', alt: 'The same deals as a table, in a saved view filtered to open deals over €5,000 and sorted by owner.' },
	S6: { id: 'S6', ...desktop, ready: false, title: 'Interactions calendar', alt: 'Calls and meetings with clients on a month calendar.' },
	S7: { id: 'S7', ...desktop, ready: false, title: 'Revenue chart', alt: 'Monthly revenue over eighteen months as a chart, with two weak months visible.' },
	S8: { id: 'S8', ...desktop, ready: true, title: 'Academy note', alt: 'A course note, "The cost of a second source": its subject and course, the supplier-switch decision it informs, the books it cites, the two supplier contacts it names, and the notes that link to it.' },
	S9: { id: 'S9', ...desktop, ready: true, title: 'Graph view', alt: 'A graph of 146 pages and 38 tags, centred on the supplier-switch decision and the notes and decisions linked to it.' },
	S10: { id: 'S10', ...desktop, ready: false, title: 'Library', alt: 'Books and papers as cards in a gallery, each with its tags.' },
	S11: { id: 'S11', ...desktop, ready: true, title: "Jules's view", alt: 'Signed in as Jules from finance: the one page Inès shared with him, Q4 supplier review, and none of her operations pages or databases.' },
	S12: { id: 'S12', ...desktop, ready: true, title: 'Tour poster', alt: 'The Arlet operations home page, the first screen of the tour.' },
};
