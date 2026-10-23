import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MASCOT_LINES } from '../../../src/data/mascot-lines';

const sectionsDir = path.resolve(process.cwd(), 'src/components/sections');

const readAllFiles = (dir: string): string[] =>
	fs
		.readdirSync(dir, { withFileTypes: true })
		.flatMap((entry) => {
			const full = path.join(dir, entry.name);
			return entry.isDirectory() ? readAllFiles(full) : [fs.readFileSync(full, 'utf-8')];
		});

const sectionFiles = readAllFiles(sectionsDir);

describe('mascot lines data', () => {
	it('has unique section ids', () => {
		const ids = MASCOT_LINES.map((entry) => entry.section);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('references sections that exist on the page', () => {
		for (const { section } of MASCOT_LINES) {
			expect(sectionFiles.some((file) => file.includes(`id="${section}"`))).toBe(true);
		}
	});

	it('keeps every line short and sentence-like', () => {
		for (const { line } of MASCOT_LINES) {
			expect(line.length).toBeLessThanOrEqual(70);
			expect(line.endsWith('.')).toBe(true);
		}
	});
});
