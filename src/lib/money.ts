// Whole euros in the visitor's language. Western digits in every locale, because the copy around an
// amount is written with them.
export function formatEuros(locale: string, amount: number): string {
	return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, numberingSystem: 'latn' }).format(amount);
}
