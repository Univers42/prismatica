// Where the page stage is between its scenes (one scene per home section).
// A scene holds still while its section is read, and morphs into the next only
// while the focus line (the middle of the viewport) crosses the boundary
// between the two sections: a window of ±morphShare of the viewport around it,
// narrowed to half of either section when one is short, so two windows never
// overlap. Tall sections never smear one shape across thousands of pixels.

export interface SceneBox {
	top: number;
	height: number;
}

export interface StageProgress {
	from: number;
	to: number;
	t: number;
}

export function stageProgress(boxes: SceneBox[], scrollY: number, viewport: number, morphShare = 0.35): StageProgress {
	if (boxes.length === 0) return { from: 0, to: 0, t: 0 };
	const focus = scrollY + viewport * 0.5;
	for (let index = 0; index < boxes.length - 1; index += 1) {
		const boundary = boxes[index + 1]!.top;
		const half = Math.min(viewport * morphShare, boxes[index]!.height / 2, boxes[index + 1]!.height / 2);
		if (focus >= boundary - half && focus < boundary + half) {
			return { from: index, to: index + 1, t: (focus - (boundary - half)) / (2 * half) };
		}
	}
	let held = 0;
	for (let index = 0; index < boxes.length; index += 1) {
		if (boxes[index]!.top <= focus) held = index;
	}
	return { from: held, to: held, t: 0 };
}
