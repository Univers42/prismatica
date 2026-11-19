export type MascotMood =
	| 'curious'
	| 'close'
	| 'gentle'
	| 'happy'
	| 'excited'
	| 'listening'
	| 'sleeping'
	| 'bye'
	| 'thinking'
	| 'shy'
	| 'proud'
	| 'seller'
	| 'laughing'
	| 'dizzy'
	| 'angry'
	| 'silly'
	| 'surprised'
	| 'love'
	| 'scared';

export type MascotState = {
	targetX: number;
	targetY: number;
	targetHeadX: number;
	targetHeadY: number;
	depthX: number;
	depthY: number;
	eyeX: number;
	eyeY: number;
	headX: number;
	headY: number;
	lastPointerAngle: number | undefined;
	orbitTravel: number;
	lastBrowLift: number;
	lastMove: number;
	lockedUntil: number;
	idleMoodShown: boolean;
	moodTimer: ReturnType<typeof setTimeout> | undefined;
	heartTimer: ReturnType<typeof setInterval> | undefined;
	zTimer: ReturnType<typeof setInterval> | undefined;
	laughTimer: ReturnType<typeof setInterval> | undefined;
	frame: number | undefined;
};

export function resetMascotState(): void {
	if (mascotState.heartTimer !== undefined) {
		globalThis.clearInterval(mascotState.heartTimer);
		mascotState.heartTimer = undefined;
	}
	if (mascotState.zTimer !== undefined) {
		globalThis.clearInterval(mascotState.zTimer);
		mascotState.zTimer = undefined;
	}
	if (mascotState.laughTimer !== undefined) {
		globalThis.clearInterval(mascotState.laughTimer);
		mascotState.laughTimer = undefined;
	}
	if (mascotState.moodTimer !== undefined) {
		globalThis.clearTimeout(mascotState.moodTimer);
		mascotState.moodTimer = undefined;
	}
	mascotState.targetX = 0;
	mascotState.targetY = 0;
	mascotState.targetHeadX = 0;
	mascotState.targetHeadY = 0;
	mascotState.depthX = 5;
	mascotState.depthY = 4;
	mascotState.eyeX = 0;
	mascotState.eyeY = 0;
	mascotState.headX = 0;
	mascotState.headY = 0;
	mascotState.lastPointerAngle = undefined;
	mascotState.orbitTravel = 0;
	mascotState.lastBrowLift = 0;
	mascotState.lastMove = Date.now();
	mascotState.lockedUntil = 0;
	mascotState.idleMoodShown = false;
	mascotState.frame = undefined;
}

export const mascotState: MascotState = {
	targetX: 0,
	targetY: 0,
	targetHeadX: 0,
	targetHeadY: 0,
	depthX: 5,
	depthY: 4,
	eyeX: 0,
	eyeY: 0,
	headX: 0,
	headY: 0,
	lastPointerAngle: undefined,
	orbitTravel: 0,
	lastBrowLift: 0,
	lastMove: Date.now(),
	lockedUntil: 0,
	idleMoodShown: false,
	moodTimer: undefined,
	heartTimer: undefined,
	zTimer: undefined,
	laughTimer: undefined,
	frame: undefined,
};