// Every product capture the site shows, keyed by the shot id of groot's docs/redesign/PLAN.md
// §6.1. The captures come from the demo account (groot scripts/media/capture.ts); until a shot
// is captured, `ready` is false and CaptureFrame draws a labelled placeholder of the same size,
// so the layout and CLS are final before the media lands. Titles and alt text, which say what is on
// screen, live in the dictionary under `site.shots`.

export type ShotId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9' | 'S10' | 'S11' | 'S12';

export type Shot = {
	id: ShotId;
	width: number;
	height: number;
	ready: boolean;
};

const desktop = { width: 1440, height: 900 } as const;

export const SHOTS: Record<ShotId, Shot> = {
	S1: { id: 'S1', ...desktop, ready: true },
	S2: { id: 'S2', ...desktop, ready: false },
	S3: { id: 'S3', ...desktop, ready: false },
	S4: { id: 'S4', ...desktop, ready: false },
	S5: { id: 'S5', ...desktop, ready: false },
	S6: { id: 'S6', ...desktop, ready: false },
	S7: { id: 'S7', ...desktop, ready: false },
	S8: { id: 'S8', ...desktop, ready: true },
	S9: { id: 'S9', ...desktop, ready: true },
	S10: { id: 'S10', ...desktop, ready: false },
	S11: { id: 'S11', ...desktop, ready: true },
	S12: { id: 'S12', ...desktop, ready: true },
};
