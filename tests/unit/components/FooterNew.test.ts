import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DICTIONARY, SUPPORTED_LOCALES, DEFAULT_LOCALE, t } from '../../../src/lib/i18n';

function getNestedTranslation(dictionary: unknown, keyPath: string): string | undefined {
  const segments = keyPath.split('.');
  let current: any = dictionary;
  for (const segment of segments) {
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

describe('FooterNew Component Specification', () => {
  const componentPath = path.resolve(process.cwd(), 'src/components/sections/FooterNew.astro');
  const content = fs.readFileSync(componentPath, 'utf-8');

  describe('Accessibility & Semantic Landmark Structure', () => {
    it('defines a semantic contentinfo landmark with the base styling class', () => {
      expect(content).toContain('<footer class="footer-new" role="contentinfo">');
    });

    it('contains an accessible navigation landmark with an explicit label', () => {
      expect(content).toContain('<nav class="footer-new__nav" aria-label="Footer">');
    });

    it('renders the brand link pointing to the root URL with decorative logo and wordmark', () => {
      expect(content).toContain('class="footer-new__brand" href="/"');
      expect(content).toContain('<PrismaticaLogo decorative />');
      expect(content).toContain('<span class="footer-new__wordmark">Prismatica</span>');
      expect(content).toContain('<span class="footer-new__logo" aria-hidden="true">');
    });
  });

  describe('Navigation Architecture & Route Integrity', () => {
    it('declares structured navigation groups for Product, Resources, and Legal sections', () => {
      expect(content).toContain("headingKey: 'footer.groupProduct'");
      expect(content).toContain("headingKey: 'footer.groupResources'");
      expect(content).toContain("headingKey: 'footer.groupLegal'");
    });

    it('routes primary product links to corresponding section anchors and documentation', () => {
      expect(content).toContain("href: '#apps'");
      expect(content).toContain("href: '#product'");
      expect(content).toContain("href: '#pricing'");
      expect(content).toContain("href: '/docs/'");
    });

    it('routes resources links to documentation, product overview, and FAQ anchors', () => {
      expect(content).toContain("href: '/#product'");
      expect(content).toContain("href: '/#faq'");
    });

    it('routes legal compliance links to respective policy paths', () => {
      expect(content).toContain("href: '/legal/privacy-policy/'");
      expect(content).toContain("href: '/legal/terms/'");
      expect(content).toContain("href: '/legal/cookies/'");
      expect(content).toContain("href: '/legal/data-rights/'");
    });

    it('provides an accessible cookie management trigger button within legal navigation', () => {
      expect(content).toContain('data-manage-cookies');
      expect(content).toContain('class="footer-new__link-button"');
      expect(content).toContain('type="button"');
      expect(content).toContain('data-i18n="footer.cookieSettings"');
    });

    it('does not contain deprecated or redundant company column elements', () => {
      expect(content).not.toContain('footer.groupCompany');
      expect(content).not.toContain('Company');
    });
  });

  describe('Social Media Channels & External Security', () => {
    it('renders GitHub link with verified destination, rel hardening, and accessible label', () => {
      expect(content).toContain('href="https://github.com/Univers42/prismatica"');
      expect(content).toContain('target="_blank"');
      expect(content).toContain('rel="noopener noreferrer"');
      expect(content).toContain('aria-label="GitHub"');
    });

    it('renders LinkedIn group link with verified destination, rel hardening, and accessible label', () => {
      expect(content).toContain('href="https://www.linkedin.com/groups/42835490/"');
      expect(content).toContain('target="_blank"');
      expect(content).toContain('rel="noopener noreferrer"');
      expect(content).toContain('aria-label="LinkedIn"');
    });

    it('ensures social icons are marked decorative so screen readers rely on accessible names', () => {
      const socialBlock = content.slice(content.indexOf('footer-new__social'));
      expect(socialBlock).toContain('aria-hidden="true"');
    });

    it('ensures social links are positioned solely in footer base without duplicate column links', () => {
      const navBlock = content.slice(content.indexOf('footer-new__nav'), content.indexOf('footer-new__base'));
      expect(navBlock).not.toContain('github.com');
      expect(navBlock).not.toContain('linkedin.com');
    });
  });

  describe('Newsletter Subscription Form Specification', () => {
    it('configures subscription form with API endpoint, POST method, and novalidate attribute', () => {
      expect(content).toContain('action="/api/newsletter/subscribe"');
      expect(content).toContain('method="post"');
      expect(content).toContain('novalidate');
      expect(content).toContain('data-newsletter-signup');
    });

    it('binds email input with required validation and standard autocomplete hint', () => {
      expect(content).toContain('id="footer-newsletter-email"');
      expect(content).toContain('type="email"');
      expect(content).toContain('name="email"');
      expect(content).toContain('autocomplete="email"');
      expect(content).toContain('required');
      expect(content).toContain('for="footer-newsletter-email"');
    });

    it('binds explicit consent checkbox with required attribute and linked label', () => {
      expect(content).toContain('id="footer-newsletter-consent"');
      expect(content).toContain('type="checkbox"');
      expect(content).toContain('name="newsletter_consent"');
      expect(content).toContain('for="footer-newsletter-consent"');
    });

    it('integrates Cloudflare Turnstile verification slots and hidden token container', () => {
      expect(content).toContain('data-turnstile-slot');
      expect(content).toContain('data-turnstile-token');
      expect(content).toContain('type="hidden" name="turnstileToken"');
    });

    it('provides an accessible live output region for submission feedback', () => {
      expect(content).toContain('<output class="footer-new__newsletter-status" data-newsletter-status aria-live="polite"></output>');
    });
  });

  describe('Regulatory Compliance & GDPR Notice', () => {
    it('displays dynamic copyright notice with current year token', () => {
      expect(content).toContain('data-i18n="footer.copyright"');
      expect(content).toContain('new Date().getFullYear()');
      expect(content).toContain('{ year: String(year) }');
    });

    it('contains GDPR contact notice with designated email link', () => {
      expect(content).toContain('data-i18n="footer.gdprContact"');
      expect(content).toContain('href="mailto:dev.pro.photo@gmail.com"');
    });
  });

  describe('Internationalization (i18n) Dictionary Coverage', () => {
    const referencedKeys = [
      'footer.tagline',
      'footer.newsletterLabel',
      'footer.newsletterButton',
      'footer.newsletterConsent',
      'footer.newsletterMeta',
      'footer.groupProduct',
      'footer.groupResources',
      'footer.groupLegal',
      'footer.linkDocs',
      'footer.linkOverview',
      'footer.linkFaq',
      'footer.linkPrivacy',
      'footer.linkTerms',
      'footer.linkCookies',
      'footer.linkDataRights',
      'footer.cookieSettings',
      'footer.copyright',
      'footer.gdprContact',
    ] as const;

    it('defines non-empty translation strings for every referenced key in all supported locales', () => {
      for (const locale of SUPPORTED_LOCALES) {
        for (const key of referencedKeys) {
          const translation = getNestedTranslation(DICTIONARY[locale], key);
          expect(translation, `Missing translation for [${key}] in locale [${locale}]`).toBeDefined();
          expect(typeof translation).toBe('string');
          expect(translation!.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('interpolates year parameter into copyright string correctly across all locales', () => {
      const currentYear = '2026';
      for (const locale of SUPPORTED_LOCALES) {
        const rendered = t(locale, 'footer.copyright', { year: currentYear });
        expect(rendered).toContain(currentYear);
        expect(rendered).not.toContain('{year}');
      }
    });

    it('verifies purged obsolete keys are absent from the active translation dictionary', () => {
      const purgedKeys = ['footer.groupCompany', 'footer.linkGithub', 'footer.linkLinkedin'];
      for (const locale of SUPPORTED_LOCALES) {
        for (const key of purgedKeys) {
          expect(getNestedTranslation(DICTIONARY[locale], key)).toBeUndefined();
        }
      }
    });

    it('resolves default locale fallback when an unspecified locale is provided', () => {
      expect(DEFAULT_LOCALE).toBe('en');
      expect(content).toContain('{ locale = DEFAULT_LOCALE } = Astro.props');
      expect(content).toContain('normalizeLocale(locale,');
    });
  });
});
