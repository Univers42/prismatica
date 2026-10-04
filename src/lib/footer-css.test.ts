import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Footer CSS alignment', () => {
	it('uses proven portal margin for checkbox alignment', () => {
		const filePath = path.join(process.cwd(), 'src/components/sections/FooterNew.astro');
		const content = fs.readFileSync(filePath, 'utf-8');
		
		// 1. The container should use grid, not flex
		expect(content).toMatch(/\.footer-new__consent\s*\{[^}]*display:\s*grid/);
		expect(content).toMatch(/\.footer-new__consent\s*\{[^}]*grid-template-columns:\s*auto\s+1fr/);
		
		// 2. The margin should not have magic numbers like 0.1rem
		expect(content).not.toMatch(/margin:\s*0\.1rem\s*0\s*0/);
		
		// 3. The vertical alignment should be mathematically derived from line-height
		expect(content).toMatch(/margin-top:\s*0\.18rem/);
	});
});
