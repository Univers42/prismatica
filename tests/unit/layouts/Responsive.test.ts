import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (relative: string): string =>
	fs.readFileSync(path.resolve(process.cwd(), relative), 'utf-8');

describe('Frontend responsiveness (#15)', () => {
	describe('desktop + mobile foundations', () => {
		it('Layout ships a device-width viewport meta (mobile browsers scale correctly)', () => {
			const layout = read('src/layouts/Layout.astro');
			expect(layout).toMatch(/name=["']viewport["'][^>]*content=["']width=device-width/);
		});

		it('Header folds the nav into a <details> menu below 48rem, which opens with no script', () => {
			const header = read('src/components/site/SiteHeader.astro');
			expect(header).toContain('@media (min-width: 48rem)');
			expect(header).toContain('<details class="site-menu">');
			expect(header).toContain('<summary class="button button--icon"');
		});

		it('Header menu closes after a mobile nav choice and on Escape', () => {
			const main = read('src/scripts/main.ts');
			expect(main).toContain("closestFromEvent(event, 'a[href], button')");
			expect(main).toContain("event.key !== 'Escape'");
			expect(main).toContain('menu.open = false');
		});
	});

	describe('section grids reflow on narrow viewports', () => {
		it('The silo cards use auto-fit minmax so they stack on small screens', () => {
			const silo = read('src/components/site/Silo.astro');
			expect(silo).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/);
		});

		it('The saved view uses auto-fit minmax for desktop/mobile columns', () => {
			const savedView = read('src/components/site/SavedView.astro');
			expect(savedView).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/);
		});

		it('Footer is a single column until 48rem', () => {
			const footer = read('src/components/site/SiteFooter.astro');
			expect(footer).toContain('@media (min-width: 48rem)');
			expect(footer).toMatch(/\.site-footer__grid\s*\{\s*display:\s*grid;\s*gap:/);
		});
	});
});
