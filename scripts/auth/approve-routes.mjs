/**
 * The three routes the approval link page calls. They read no cookie and write none: the approving
 * device may be any browser, and it never gets a session. The token in the body is the only credential.
 *
 * Caveat: the per-IP bucket (`otpApprove`) is shared by everyone behind one NAT or one Funnel
 * address; it bounds token guessing (256 bits, so not a real threat) and scanner floods, nothing more.
 */

/**
 * @param {{loginApprove: object, rateLimit: Function, clientIp: Function, readJson: Function, json: Function}} deps
 * @returns {Array<[string, Function]>}
 */
export function approveRoutes({ loginApprove, rateLimit, clientIp, readJson, json }) {
	const action = (flow) => async (request, response) => {
		const ip = clientIp(request);
		const retryAfter = await rateLimit(ip, 'otpApprove');
		if (retryAfter) {
			json(response, 429, { error: 'rate_limited', message: 'Too many attempts. Please retry later.' }, { 'retry-after': String(retryAfter) });
			return;
		}
		const result = await flow(await readJson(request), ip);
		json(response, result.status, result.body);
	};

	return [
		['POST /api/auth/mfa/approve/summary', action((payload) => loginApprove.summary(payload.token))],
		['POST /api/auth/mfa/approve', action((payload, ip) => loginApprove.approve({ token: payload.token, match: payload.match, ip }))],
		['POST /api/auth/mfa/deny', action((payload, ip) => loginApprove.deny({ token: payload.token, ip }))],
	];
}
