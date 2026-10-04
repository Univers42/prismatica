import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Index Page Anchors', () => {
	it('contains required IDs for footer navigation', () => {
		const filePath = path.join(process.cwd(), 'src/pages/index.astro');
		const content = fs.readFileSync(filePath, 'utf-8');
		
		expect(content).toContain('id="product"');
		expect(content).toContain('id="pricing"');
		expect(content).toContain('id="faq"');
	});
});
