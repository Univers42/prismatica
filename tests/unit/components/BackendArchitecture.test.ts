import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('BackendArchitecture component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/BackendArchitecture.astro'), 'utf-8');
  const studioContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/studio-network/StudioNetworkStory.astro'), 'utf-8');
  const showcaseContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/stack-showcase/StackShowcase.astro'), 'utf-8');
  const whyContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/stack-showcase/WhySlide.astro'), 'utf-8');

  it('declares props with locale and imports i18n helpers in all components', () => {
    expect(content).toContain('readonly locale?: string');
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
    expect(studioContent).toContain('readonly locale?: string');
    expect(showcaseContent).toContain('readonly locale?: string');
    expect(whyContent).toContain('readonly locale?: string');
  });

  it('binds architecture and subcomponent copy to data-i18n attributes', () => {
    expect(content).toContain('backendArchitecture.eyebrow');
    expect(content).toContain('backendArchitecture.title');
    expect(content).toContain('backendArchitecture.lede');

    expect(studioContent).toContain('studioNetwork.legendOrg');
    expect(studioContent).toContain('studioNetwork.assistantPrompt');
    expect(studioContent).toContain('studioNetwork.stepEnginesTitle');

    expect(showcaseContent).toContain('stackShowcase.title');
    expect(showcaseContent).toContain('stackShowcase.tabServicesName');

    expect(whyContent).toContain('whySlide.title');
    expect(whyContent).toContain('whySlide.problem1');
  });
});
