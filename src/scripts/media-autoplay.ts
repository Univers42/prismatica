// Product clips play only while on screen and only when the visitor allows
// motion; otherwise they stay on their poster with native controls, so the
// visitor can still choose to watch.

import { motionAllowed } from '../lib/motion-preference';

const bound = new WeakSet<HTMLVideoElement>();

export function bindMediaAutoplay(root: ParentNode): void {
	const videos = [...root.querySelectorAll<HTMLVideoElement>('video[data-media-autoplay]')].filter((video) => !bound.has(video));
	if (videos.length === 0) return;
	if (typeof IntersectionObserver === 'undefined' || !motionAllowed()) {
		videos.forEach((video) => {
			video.controls = true;
			bound.add(video);
		});
		return;
	}
	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			const video = entry.target as HTMLVideoElement;
			if (entry.isIntersecting && motionAllowed()) {
				video.play().catch(() => {
					video.controls = true;
				});
			} else {
				video.pause();
			}
		}
	}, { threshold: 0.4 });
	videos.forEach((video) => {
		bound.add(video);
		observer.observe(video);
	});
}
