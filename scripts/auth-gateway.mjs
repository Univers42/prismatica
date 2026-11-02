function handleMfaHook(response) {
	// Unimplemented MFA paths: plain 404, no "wire before production" disclosure (issue 51).
	json(response, 404, { message: 'Not found.' });
}
