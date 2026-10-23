import { describe, expect, it } from 'vitest';
import { isLand, projectSphere, spherePoint, valueNoise3 } from '../../../src/lib/sky-sphere';

describe('sky sphere', () => {
	it('puts the pole on the top limb when untilted, and tilting it toward the viewer brings it forward', () => {
		const pole = spherePoint(Math.PI / 2, 0);
		const flat = projectSphere(pole, 1.3, 0, 100);
		expect(flat.x).toBeCloseTo(0);
		expect(flat.y).toBeCloseTo(-100);
		expect(flat.z).toBeCloseTo(0);
		expect(projectSphere(pole, 0, 0.4, 100).z).toBeGreaterThan(0);
		expect(projectSphere(pole, 0, -0.4, 100).z).toBeLessThan(0);
	});

	it('faces the equator point at longitude 0 toward the viewer, and spins it away', () => {
		const front = spherePoint(0, 0);
		expect(projectSphere(front, 0, 0, 50)).toMatchObject({ x: 0, z: 1 });
		const quarter = projectSphere(front, Math.PI / 2, 0, 50);
		expect(quarter.z).toBeCloseTo(0);
		expect(Math.abs(quarter.x)).toBeCloseTo(50);
	});

	it('keeps value noise in [0, 1) and deterministic', () => {
		for (let i = 0; i < 200; i += 1) {
			const value = valueNoise3(i * 0.37, i * 0.11, i * 0.73, 5);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
			expect(valueNoise3(i * 0.37, i * 0.11, i * 0.73, 5)).toBe(value);
		}
	});

	it('covers between 30% and 60% of the sphere with land', () => {
		let land = 0;
		let total = 0;
		for (let lat = -80; lat <= 80; lat += 4) {
			for (let lon = 0; lon < 360; lon += 4) {
				total += 1;
				if (isLand(spherePoint((lat * Math.PI) / 180, (lon * Math.PI) / 180))) land += 1;
			}
		}
		expect(land / total).toBeGreaterThan(0.3);
		expect(land / total).toBeLessThan(0.6);
	});
});
