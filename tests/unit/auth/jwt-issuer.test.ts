import { describe, expect, it } from 'vitest';
import {
	assertProductionAccessTokenIssuer,
	decodeJwtPayload,
	isLocalhostJwtIssuer,
} from '../../../scripts/auth/jwt-issuer.mjs';

function tokenWithIss(iss) {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(JSON.stringify({ iss, role: 'authenticated', sub: 'u1' })).toString('base64url');
	return `${header}.${payload}.sig`;
}

describe('isLocalhostJwtIssuer', () => {
	it('treats empty and loopback issuers as local', () => {
		expect(isLocalhostJwtIssuer('')).toBe(true);
		expect(isLocalhostJwtIssuer(undefined)).toBe(true);
		expect(isLocalhostJwtIssuer('https://localhost:8443/auth/v1')).toBe(true);
		expect(isLocalhostJwtIssuer('http://127.0.0.1:9999/auth/v1')).toBe(true);
		expect(isLocalhostJwtIssuer('https://baas.example.com/auth/v1')).toBe(false);
		expect(isLocalhostJwtIssuer('https://baas.tail10f2ea.ts.net:8443/auth/v1')).toBe(false);
	});
});

describe('assertProductionAccessTokenIssuer', () => {
	it('allows any token on non-production origins', () => {
		const token = tokenWithIss('https://localhost:8443/auth/v1');
		expect(assertProductionAccessTokenIssuer(token, { productionOrigin: false }).ok).toBe(true);
	});

	it('rejects localhost issuer on production origins', () => {
		const token = tokenWithIss('https://localhost:8443/auth/v1');
		const result = assertProductionAccessTokenIssuer(token, { productionOrigin: true });
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('localhost_issuer');
	});

	it('accepts a real public issuer on production origins', () => {
		const token = tokenWithIss('https://baas.tail10f2ea.ts.net:8443/auth/v1');
		const result = assertProductionAccessTokenIssuer(token, { productionOrigin: true });
		expect(result.ok).toBe(true);
		expect(decodeJwtPayload(token)?.iss).toContain('baas.tail10f2ea.ts.net');
	});

	it('rejects unreadable tokens on production origins', () => {
		expect(assertProductionAccessTokenIssuer('not-a-jwt', { productionOrigin: true }).reason).toBe('unreadable_token');
	});
});
