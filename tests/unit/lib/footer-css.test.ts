import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Footer CSS alignment', () => {
	it('uses proven portal margin for checkbox alignment', () => {
		const scssPath = path.join(process.cwd(), 'src/styles/sections/_footer-new.scss');
		const scssContent = fs.readFileSync(scssPath, 'utf-8');

		// 1. The container should use grid, not flex
		expect(scssContent).toMatch(/\.footer-new__consent\s*\{[^}]*display:\s*grid/);
		expect(scssContent).toMatch(/\.footer-new__consent\s*\{[^}]*grid-template-columns:\s*auto\s+1fr/);

		// 2. The margin should not have magic numbers like 0.1rem
		expect(scssContent).not.toMatch(/margin:\s*0\.1rem\s*0\s*0/);

		// 3. The vertical alignment should be mathematically derived from line-height
		expect(scssContent).toMatch(/margin-top:\s*0\.18rem/);
	});

	it('maintains a local stacking context to prevent background bleed', () => {
		const scssPath = path.join(process.cwd(), 'src/styles/sections/_footer-new.scss');
		const scssContent = fs.readFileSync(scssPath, 'utf-8');

		// .footer-new needs its own relative stacking context
		expect(scssContent).toMatch(/\.footer-new\s*\{[^}]*position:\s*relative/);
		expect(scssContent).toMatch(/\.footer-new\s*\{[^}]*z-index:\s*10/);
	});

	it('imports extracted footer layout styles from dedicated scss module', () => {
		const astroPath = path.join(process.cwd(), 'src/components/sections/FooterNew.astro');
		const astroContent = fs.readFileSync(astroPath, 'utf-8');
		expect(astroContent).toContain("import '../../styles/sections/_footer-new.scss'");

		const scssPath = path.join(process.cwd(), 'src/styles/sections/_footer-new.scss');
		const scssContent = fs.readFileSync(scssPath, 'utf-8');
		expect(scssContent).toContain('.footer-new__inner');
		expect(scssContent).toContain('.footer-new__nav');
		expect(scssContent).toContain('.footer-new__social');
		expect(scssContent).toContain('.footer-new__consent');
		expect(scssContent).toContain('.footer-new__consent input');
		expect(scssContent).toContain('.footer-new__consent input:focus-visible');
		expect(scssContent).toContain('.footer-new');
	});
});