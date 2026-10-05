import { describe, it, expect } from 'vitest';
import { POST } from '../../../../../src/pages/api/newsletter/subscribe';
import type { APIContext } from 'astro';

describe('Newsletter Subscribe API', () => {
	it('returns 400 when missing email', async () => {
		const request = new Request('http://localhost/api/newsletter/subscribe', {
			method: 'POST',
			body: JSON.stringify({}),
		});
		const context = { request } as APIContext;
		
		const response = await POST(context) as Response;
		expect(response.status).toBe(400);
		
		const data = await response.json();
		expect(data.error).toContain('Email is required');
	});

	it('returns 400 when email is invalid', async () => {
		const request = new Request('http://localhost/api/newsletter/subscribe', {
			method: 'POST',
			body: JSON.stringify({ email: 'not-an-email' }),
		});
		const context = { request } as APIContext;
		
		const response = await POST(context) as Response;
		expect(response.status).toBe(400);
		
		const data = await response.json();
		expect(data.error).toContain('Invalid email format');
	});

	it('returns 200 and success message when email is valid', async () => {
		const request = new Request('http://localhost/api/newsletter/subscribe', {
			method: 'POST',
			body: JSON.stringify({ email: 'test@prismatica.dev' }),
		});
		const context = { request } as APIContext;
		
		const response = await POST(context) as Response;
		expect(response.status).toBe(200);
		
		const data = await response.json();
		expect(data.message).toBe('Check your inbox to confirm your subscription.');
	});
});
