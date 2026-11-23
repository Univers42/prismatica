let accessToken: string | null = null;

export function getAccessToken(): string | null {
	return accessToken;
}

export function setAccessToken(token: string | null): void {
	accessToken = token && token.length > 0 ? token : null;
}

export function clearAccessToken(): void {
	accessToken = null;
}
