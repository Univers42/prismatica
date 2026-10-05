import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Docs Page', () => {
	it('does not contain the temporary placeholder and shows real technical content', () => {
		const filePath = path.join(process.cwd(), 'src/pages/docs.astro');
		const content = fs.readFileSync(filePath, 'utf-8');
		
		// 1. Should NOT contain the empty placeholder text
		expect(content).not.toContain('currently being written');
		
		// 2. Should contain actual technical headings
		expect(content).toContain('Tech Stack');
		expect(content).toContain('Architecture');
	});
});
