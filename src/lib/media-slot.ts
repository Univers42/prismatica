import type { MediaRatio, MediaShot } from '../data/media-shots';
import { safePublicAssetPath } from './media-security.mjs';

// Capture size per ratio: 1600px on the long edge is sharp on a 2x phone and a
// 1440px desktop column without shipping 4K files.
const CAPTURE_SIZE: Record<MediaRatio, { width: number; height: number }> = {
	'16/10': { width: 1600, height: 1000 },
	'16/9': { width: 1600, height: 900 },
	'4/3': { width: 1600, height: 1200 },
	'1/1': { width: 1200, height: 1200 },
	'4/5': { width: 1200, height: 1500 },
	'9/16': { width: 900, height: 1600 },
};

const VIDEO_TYPES: Record<string, string> = { webm: 'video/webm', mp4: 'video/mp4' };

export type ResolvedMediaSlot =
	| { state: 'placeholder'; ratioClass: string; width: number; height: number; label: string; kind: MediaShot['kind']; durationSeconds?: number }
	| { state: 'image'; ratioClass: string; width: number; height: number; label: string; src: string; srcset?: string }
	| { state: 'video'; ratioClass: string; width: number; height: number; label: string; src: string; type: string; poster?: string };

/** CSS modifier for a ratio: classes, not inline style, because the CSP forbids style attributes. */
export function ratioClass(ratio: MediaRatio): string {
	return `media-slot--r${ratio.replace('/', 'x')}`;
}

export function captureSize(ratio: MediaRatio): { width: number; height: number } {
	return CAPTURE_SIZE[ratio];
}

/** Turns a shot into what MediaSlot renders; every file path goes through the asset allowlist. */
export function resolveMediaSlot(shot: MediaShot, baseUrl = '/'): ResolvedMediaSlot {
	const { width, height } = captureSize(shot.ratio);
	const base = { ratioClass: ratioClass(shot.ratio), width, height, label: shot.label };
	if (!shot.src) {
		return { ...base, state: 'placeholder', kind: shot.kind, durationSeconds: shot.durationSeconds };
	}
	const src = safePublicAssetPath(shot.src, baseUrl);
	if (shot.kind === 'image') {
		if (!shot.srcSmall) return { ...base, state: 'image', src };
		const srcset = `${safePublicAssetPath(shot.srcSmall, baseUrl)} ${width / 2}w, ${src} ${width}w`;
		return { ...base, state: 'image', src, srcset };
	}
	const extension = shot.src.split('.').pop()?.toLowerCase() ?? '';
	const type = VIDEO_TYPES[extension];
	if (!type) {
		throw new Error(`Media shot "${shot.id}" is a video but ${shot.src} is not .webm or .mp4.`);
	}
	const poster = shot.poster ? safePublicAssetPath(shot.poster, baseUrl) : undefined;
	return { ...base, state: 'video', src, type, poster };
}
