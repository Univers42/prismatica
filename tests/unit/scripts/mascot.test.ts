import { describe, it, expect, afterEach, vi } from 'vitest';
import { mountMascot, setMountedMascotMood } from '../../../src/scripts/mascot';

describe('Mascot', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	describe('mountMascot', () => {
		it('mounts .binocle button into #mascot-anchor', () => {
			document.body.innerHTML = '<div id="mascot-anchor"></div>';
			mountMascot();
			const mascot = document.querySelector('.binocle');
			expect(mascot).not.toBeNull();
			expect(mascot?.classList.contains('binocle')).toBe(true);
		});

		it('calls onOpenPortal when provided and mascot is clicked', () => {
			const onOpenPortal = vi.fn();
			document.body.innerHTML = '<div id="mascot-anchor"></div>';
			mountMascot(() => onOpenPortal());
			const mascot = document.querySelector('.binocle') as HTMLButtonElement;
			mascot.click();
			expect(onOpenPortal).toHaveBeenCalledTimes(1);
		});
	});

	describe('setMountedMascotMood', () => {
		it('updates data-mood attribute on mascot element', () => {
			document.body.innerHTML = '<button class="binocle" data-mood="curious"></button>';
			setMountedMascotMood('happy', 1000);
			const mascot = document.querySelector('.binocle');
			expect(mascot?.getAttribute('data-mood')).toBe('happy');
		});
	});
});