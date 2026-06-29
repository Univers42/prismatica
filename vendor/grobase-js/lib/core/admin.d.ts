/**
 * Guard for privileged admin surfaces (webhooks / tenants / provision /
 * migrate). These gateway routes are internal-only (ip-restriction + service
 * token); the SDK must send the service-role key as both `apikey` and bearer.
 * Centralizes the "missing key" message so it is not scattered per-client.
 */
export declare function requireAdminKey(serviceRoleKey: string | undefined, surface: string): string;
