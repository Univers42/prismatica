import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('404 Page', () => {
	it('exists and contains the correct structure', () => {
		const filePath = path.join(process.cwd(), 'src/pages/404.astro');
		
		// 1. File exists
		expect(fs.existsSync(filePath), '404.astro should exist').toBe(true);
		
		const content = fs.readFileSync(filePath, 'utf-8');
		
		// 2. Imports the layout
		expect(content).toMatch(/import Layout from ['"]\.\.\/layouts\/Layout\.astro['"]/);
		
		// 3. Contains Layout, Header and Footer wrappers
		expect(content).toContain('<Layout');
		expect(content).toContain('</Layout>');
		expect(content).toMatch(/<Header.*?\/>/);
		expect(content).toMatch(/<Footer.*?\/>/);
		
		// 4. Contains a link to return home
		expect(content).toContain('href="/"');
		
		// 5. Explicitly states it is a 404/not found page
		expect(content).toMatch(/404/i);
	});
});
