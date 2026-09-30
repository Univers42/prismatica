import { validateEmail } from '../hooks/useAuth';

export type EmailValidationResult = {
	valid: boolean;
	state: 'idle' | 'warning' | 'error' | 'success';
	message: string;
};

const COMMON_EMAIL_DOMAINS = [
	'gmail.com', 'outlook.com', 'hotmail.com', 'icloud.com',
	'yahoo.com', 'proton.me', 'protonmail.com', 'live.com'
];

const EMAIL_DOMAIN_ALIASES: Record<string, string> = {
	'gmail.con': 'gmail.com',
	'gmail.co': 'gmail.com',
	'gamil.com': 'gmail.com',
	'gmial.com': 'gmail.com',
	'gnail.com': 'gmail.com',
	'hotmai.com': 'hotmail.com',
	'hotmail.con': 'hotmail.com',
	'outlok.com': 'outlook.com',
	'outlook.con': 'outlook.com',
	'icloud.con': 'icloud.com',
	'yaho.com': 'yahoo.com',
	'yahoo.con': 'yahoo.com',
};

export function editDistance(left: string, right: string): number {
	const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
	for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
		const current = [leftIndex];
		for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
			const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
			current[rightIndex] = Math.min(
				(current[rightIndex - 1] ?? 0) + 1,
				(previous[rightIndex] ?? 0) + 1,
				(previous[rightIndex - 1] ?? 0) + substitutionCost,
			);
		}
		for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
			previous[rightIndex] = current[rightIndex] as number;
		}
	}
	return previous[right.length] as number;
}

export function suggestedEmailDomain(domain: string): string {
	const normalized = domain.toLowerCase().trim();
	if (EMAIL_DOMAIN_ALIASES[normalized]) {
		return EMAIL_DOMAIN_ALIASES[normalized];
	}
	const closeMatch = COMMON_EMAIL_DOMAINS.find((candidate) => editDistance(normalized, candidate) === 1);
	return closeMatch ?? '';
}

export function validateEmailFormat(email: string, isRequired: boolean, isNativeValid: boolean): EmailValidationResult {
	if (!email) {
		return { valid: !isRequired, state: 'idle', message: isRequired ? 'Enter your email address.' : '' };
	}
	if (!isNativeValid || !validateEmail(email) || email.includes('..')) {
		return { valid: false, state: 'error', message: 'Please enter a valid email address (e.g. you@example.com).' };
	}
	const domain = email.split('@').pop() ?? '';
	const suggestion = suggestedEmailDomain(domain);
	if (suggestion && suggestion !== domain.toLowerCase()) {
		return { valid: true, state: 'warning', message: `Did you mean ${email.slice(0, email.lastIndexOf('@') + 1)}${suggestion}?` };
	}
	return { valid: true, state: 'success', message: 'Email format looks correct.' };
}
