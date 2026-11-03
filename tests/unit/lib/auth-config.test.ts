import { describe, expect, it } from 'vitest';
import { turnstileWidgetSiteKey } from '../../../src/lib/auth-config';

// prismatica-eta is built with no PUBLIC_TURNSTILE_SITE_KEY. The portal must then send the
// gateway's fixed token instead of waiting for a widget whose script the layout never loads.
describe('turnstileWidgetSiteKey', () => {
	it('has no widget when the build sets no key', () => {
		expect(turnstileWidgetSiteKey('')).toBe('');
		expect(turnstileWidgetSiteKey('   ')).toBe('');
	});

	it('has no widget for the local dev placeholder or a Cloudflare test key', () => {
		expect(turnstileWidgetSiteKey('local-dev-turnstile-key')).toBe('');
		expect(turnstileWidgetSiteKey('1x00000000000000000000AA')).toBe('');
		expect(turnstileWidgetSiteKey('2x00000000000000000000AB')).toBe('');
		expect(turnstileWidgetSiteKey('3x00000000000000000000FF')).toBe('');
	});

	it('renders a widget with a real key, trimmed', () => {
		expect(turnstileWidgetSiteKey(' 0x4AAAAAAABkMYinukE8nzY ')).toBe('0x4AAAAAAABkMYinukE8nzY');
	});
});
