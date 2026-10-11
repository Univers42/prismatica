import { describe, it, expect } from 'vitest';
import {
	SERVICES,
	PRESETS,
	EDGES,
	NODE_POSITIONS,
	getNodeCenter,
} from '../../../src/data/backend-architecture';

describe('Backend Architecture Data', () => {
	it('defines required services that exist in positions map', () => {
		expect(SERVICES.length).toBeGreaterThan(10);
		SERVICES.forEach((svc) => {
			expect(svc.id).toBeTruthy();
			expect(svc.name).toBeTruthy();
			expect(NODE_POSITIONS[svc.id]).toBeDefined();
			expect(NODE_POSITIONS[svc.id]?.w).toBeGreaterThan(0);
			expect(NODE_POSITIONS[svc.id]?.h).toBeGreaterThan(0);
		});
	});

	it('defines valid presets referencing existing service IDs', () => {
		expect(PRESETS.length).toBeGreaterThanOrEqual(4);
		const serviceIds = new Set(SERVICES.map((s) => s.id));
		PRESETS.forEach((preset) => {
			expect(preset.id).toBeTruthy();
			expect(preset.label).toBeTruthy();
			preset.enabled.forEach((enabledId) => {
				expect(serviceIds.has(enabledId)).toBe(true);
			});
		});
	});

	it('defines edges where source and destination nodes exist', () => {
		const serviceIds = new Set(SERVICES.map((s) => s.id));
		EDGES.forEach(([from, to]) => {
			expect(serviceIds.has(from)).toBe(true);
			expect(serviceIds.has(to)).toBe(true);
		});
	});

	it('computes center coordinates correctly from node positions', () => {
		const kongPos = NODE_POSITIONS.kong;
		expect(kongPos).toBeDefined();
		if (!kongPos) return;
		const center = getNodeCenter('kong');
		expect(center.cx).toBe(kongPos.x + kongPos.w / 2);
		expect(center.cy).toBe(kongPos.y + kongPos.h / 2);
	});
});
