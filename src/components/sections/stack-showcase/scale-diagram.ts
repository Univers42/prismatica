// Driver for the scaling slide (ScaleDiagram.astro): the load control sets
// how many pod squares each plane shows. Pods past a plane's floor are the
// ones the autoscaler added, so they take the accent colour.
// CSP: the stagger delay is written through style.setProperty.

import { LEVELS, PLANES, type LoadLevel } from '../../../data/stack-scale';
import { replicasAt, totalPods } from '../../../lib/stack-scale';

const isLevel = (value: string): value is LoadLevel => LEVELS.some((level) => level.id === value);

export function bindScaleDiagram(root: HTMLElement): void {
	const pods = [...root.querySelectorAll<SVGRectElement>('[data-pod]')];
	pods.forEach((pod) => pod.style.setProperty('--pod-delay', `${Number(pod.dataset.index ?? 0) * 45}ms`));

	const apply = (level: LoadLevel) => {
		for (const plane of PLANES) {
			const count = replicasAt(plane, level);
			for (const pod of pods.filter((entry) => entry.dataset.pod === plane.id)) {
				const index = Number(pod.dataset.index ?? 0);
				pod.toggleAttribute('data-on', index < count);
				pod.toggleAttribute('data-extra', plane.kind === 'autoscaled' && index >= plane.min);
			}
			const label = root.querySelector(`[data-count="${plane.id}"]`);
			if (label) label.textContent = `${count} ${count === 1 ? 'pod' : 'pods'}`;
		}
		const total = root.querySelector('[data-scale-total]');
		if (total) total.textContent = String(totalPods(level));
		const caption = root.querySelector('[data-scale-caption]');
		if (caption) caption.textContent = LEVELS.find((entry) => entry.id === level)?.caption ?? '';
	};

	root.addEventListener('change', (event) => {
		const input = event.target;
		if (input instanceof HTMLInputElement && input.name === 'stack-load' && isLevel(input.value)) apply(input.value);
	});
}
