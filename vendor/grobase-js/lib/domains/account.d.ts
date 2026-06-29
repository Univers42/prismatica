import { HttpClient } from '../core/http.js';
import type { BuilderPreviewInput, BuilderPreviewResult, TenantApiKey, TenantApiKeyIssued, TenantEntitlementPatch, TenantEntitlements, TenantMount, TenantMountCreateInput, TenantSelfKeyCreateInput, TenantSelfResult, TenantUsage } from '../types.js';
/** Standalone construction: a base URL + the calling tenant's bearer token. */
export interface AccountClientOptions {
    /** Gateway base URL, e.g. `https://api.grobase.dev`. */
    baseUrl: string;
    /**
     * Bearer credential: EITHER a tenant API key OR a GoTrue user JWT. The server
     * resolves the calling tenant ("me") from this credential.
     */
    token: string;
    /** Override the global `fetch` (e.g. for Node < 18 or test doubles). */
    fetch?: typeof fetch;
    timeoutMs?: number;
}
/**
 * Tenant **self-service** control surface (`/v1/tenants/me*`).
 *
 * Unlike {@link AdminClient} (which needs an internal service-role key and hits
 * the privileged `/admin/v1/*` registry), this surface is the tenant acting on
 * *itself*: read your plan/entitlements, your usage, manage your own API keys,
 * and request a plan change. Authenticate with EITHER a tenant API key OR a
 * GoTrue user JWT — the server resolves "me" from the bearer.
 *
 * Two ways in:
 *   • via the main client — `createClient(...).account` (shares its transport;
 *     the bearer defaults to the session access token / anon key per request);
 *   • standalone — `new AccountClient({ baseUrl, token })`.
 */
export declare class AccountClient {
    private readonly http;
    /** Caller-supplied bearer (standalone mode). Undefined when wired into the
     * main client, where the shared transport supplies auth. */
    private readonly token?;
    constructor(http: HttpClient);
    constructor(options: AccountClientOptions);
    /** GET /v1/tenants/me — the calling tenant + what its plan entitles. */
    getSelf(): Promise<TenantSelfResult>;
    /**
     * GET /v1/tenants/me/usage[?period=] — metered usage for a billing period.
     * `period` is server-defined (e.g. `"2026-06"`); omit for the current one.
     */
    getUsage(period?: string): Promise<TenantUsage>;
    /** GET /v1/tenants/me/keys — the calling tenant's API keys (redacted). */
    listKeys(): Promise<TenantApiKey[]>;
    /**
     * POST /v1/tenants/me/keys — issue a new API key. The cleartext `key` is
     * returned **exactly once** in the response; store it now or lose it.
     */
    createKey(input: TenantSelfKeyCreateInput): Promise<TenantApiKeyIssued>;
    /** DELETE /v1/tenants/me/keys/{keyId} — revoke one of the tenant's keys. */
    revokeKey(keyId: string): Promise<{
        revoked: boolean;
    }>;
    /** PATCH /v1/tenants/me {plan} — request a plan change for the tenant. */
    changePlan(plan: string): Promise<TenantSelfResult>;
    /** GET /v1/tenants/me/mounts — the calling tenant's data mounts. */
    listMounts(): Promise<TenantMount[]>;
    /**
     * POST /v1/tenants/me/mounts — register a mount on the calling tenant. The
     * engine/isolation must be within the tenant's ceiling (clean 403 otherwise).
     */
    createMount(input: TenantMountCreateInput): Promise<TenantMount>;
    /** DELETE /v1/tenants/me/mounts/{id} — remove one of the tenant's mounts. */
    deleteMount(id: string): Promise<{
        deleted: boolean;
    }>;
    /**
     * GET /v1/tenants/me/entitlements — the calling tenant's effective
     * entitlement (named tier overlaid by its custom row, clamped to the ceiling)
     * plus the ceiling and a `custom` flag.
     */
    getEntitlements(): Promise<TenantEntitlements>;
    /**
     * PATCH /v1/tenants/me/entitlements — narrow/customize the entitlement WITHIN
     * the ceiling (capabilities OFF freely, never ON past the ceiling). The
     * server validates at compose time and clamps on every resolve.
     */
    patchEntitlements(patch: TenantEntitlementPatch): Promise<TenantEntitlements>;
    /**
     * POST /v1/tenants/me/builder — dry-run a proposed entitlement + mount set
     * against the ceiling WITHOUT persisting (`valid` + `violations` + the
     * `clamped` result and `mountBudget`).
     */
    previewBuilder(input: BuilderPreviewInput): Promise<BuilderPreviewResult>;
    private request;
}
