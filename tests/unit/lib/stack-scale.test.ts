import { describe, expect, it } from 'vitest';
import { LINKS, PLANES } from '../../../src/data/stack-scale';
import { mermaidSource, replicasAt, totalPods } from '../../../src/lib/stack-scale';

const plane = (id: string) => PLANES.find((entry) => entry.id === id)!;

describe('stack scale', () => {
	it('runs one of each on a laptop and spans the chart range on a cluster', () => {
		expect(replicasAt(plane('kong'), 'laptop')).toBe(1);
		expect(replicasAt(plane('kong'), 'quiet')).toBe(2);
		expect(replicasAt(plane('kong'), 'busy')).toBe(5);
		expect(replicasAt(plane('kong'), 'peak')).toBe(8);
		expect(replicasAt(plane('data'), 'peak')).toBe(10);
	});

	it('never scales the stateful or hand-scaled planes', () => {
		for (const level of ['quiet', 'busy', 'peak'] as const) {
			expect(replicasAt(plane('postgres'), level)).toBe(1);
			expect(replicasAt(plane('redis'), level)).toBe(1);
			expect(replicasAt(plane('realtime'), level)).toBe(2);
		}
		expect(replicasAt(plane('ingress'), 'peak')).toBe(0);
	});

	it('totals the pods per level', () => {
		expect(totalPods('laptop')).toBe(7);
		expect(totalPods('quiet')).toBe(12);
		expect(totalPods('peak')).toBe(34);
	});

	it('writes a Mermaid flowchart with every plane and link', () => {
		const source = mermaidSource();
		expect(source.startsWith('flowchart TD\n')).toBe(true);
		for (const entry of PLANES) expect(source).toContain(`${entry.id}`);
		for (const [from, to] of LINKS) expect(source).toContain(`  ${from} --> ${to}\n`);
		expect(source).toContain('postgres[("PostgreSQL<br/>StatefulSet, 1")]');
		expect(source).toContain('class kong,data,tenant,registry hpa');
	});
});
