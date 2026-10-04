import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json();
		
		if (!body || !body.email) {
			return new Response(JSON.stringify({ error: 'Email is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const email = String(body.email).trim();
		// Basic email validation regex
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return new Response(JSON.stringify({ error: 'Invalid email format' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Mock success response
		return new Response(JSON.stringify({ message: 'Check your inbox to confirm your subscription.' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Invalid request body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
