import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('HeroNew component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/HeroNew.astro'), 'utf-8');

  it('declares props with locale', () => {
    expect(content).toContain('type Props = {');
    expect(content).toContain('readonly locale?: string');
  });

  it('localizes hero copy elements via dictionary keys', () => {
    for (const key of ['hero.title', 'hero.lede', 'hero.startFree', 'hero.seeApps', 'hero.note']) {
      expect(content).toContain(`'${key}'`);
    }
  });
});