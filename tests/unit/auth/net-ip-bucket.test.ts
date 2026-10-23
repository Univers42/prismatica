// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ipBucket, normalizeIp } from '../../../scripts/auth/net-ip.mjs';

describe('ipBucket', () => {
	it('keeps an IPv4 address and the unknown marker as they are', () => {
		expect(ipBucket('203.0.113.7')).toBe('203.0.113.7');
		expect(ipBucket('unknown')).toBe('unknown');
	});

	it('puts two addresses of one /64 in one bucket and a neighbouring /64 in another', () => {
		const a = ipBucket('2001:db8:1:2::1');
		expect(ipBucket('2001:db8:1:2:ffff:aaaa:bbbb:cccc')).toBe(a);
		expect(ipBucket('2001:0DB8:0001:0002:0:0:0:9')).toBe(a);
		expect(ipBucket('2001:db8:1:3::1')).not.toBe(a);
	});

	it('expands :: at the start, in the middle and at the end', () => {
		expect(ipBucket('::1')).toBe(ipBucket('0:0:0:0:5:6:7:8'));
		expect(ipBucket('2001:db8::1')).toBe(ipBucket('2001:db8:0:0:9::'));
		expect(ipBucket('2001:db8:1:2::')).toBe(ipBucket('2001:db8:1:2:0:0:0:1'));
	});

	it('drops an IPv6 zone id and leaves a malformed value alone', () => {
		expect(ipBucket('fe80::1%eth0')).toBe(ipBucket('fe80::2'));
		expect(ipBucket('not an ip')).toBe('not an ip');
	});

	it('keys a bracketed IPv6 like the bare one', () => {
		expect(ipBucket('[2001:db8::1]')).toBe(ipBucket('2001:db8::2'));
	});

	it('keys every spelling of an IPv4-mapped address as the IPv4 address', () => {
		expect(ipBucket('::ffff:1.2.3.4')).toBe('1.2.3.4');
		expect(ipBucket('0:0:0:0:0:ffff:1.2.3.4')).toBe('1.2.3.4');
		expect(ipBucket('[::ffff:1.2.3.4]')).toBe('1.2.3.4');
		expect(ipBucket('::ffff:5.6.7.8')).not.toBe(ipBucket('::ffff:1.2.3.4'));
	});
});

describe('normalizeIp', () => {
	it('strips brackets and maps the long mapped form to IPv4', () => {
		expect(normalizeIp('[2001:db8::1]')).toBe('2001:db8::1');
		expect(normalizeIp('0:0:0:0:0:ffff:1.2.3.4')).toBe('1.2.3.4');
		expect(normalizeIp('::FFFF:1.2.3.4')).toBe('1.2.3.4');
	});
});
