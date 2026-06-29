import type { HttpClient } from '../core/http.js';
import type { MigrateInput, ProvisionInput, ProvisionResult, Tenant, TenantBootstrapInput, TenantBootstrapResult, TenantCreateInput, TenantUpdateInput } from '../types.js';
/**
 * Privileged control-plane surface (`/admin/v1/*`).
 *
 * **Admin-only / server-side.** Every route here is internal-only at the
 * gateway (ip-restriction + an upstream service token); the client must be
 * constructed with a `serviceRoleKey`. Do NOT expose this to browser clients.
 */
export declare class AdminClient {
    private readonly http;
    private readonly serviceRoleKey?;
    readonly tenants: TenantsClient;
    readonly migrate: MigrateClient;
    constructor(http: HttpClient, serviceRoleKey?: string | undefined);
    /**
     * Declarative tenant-stack reconcile (G2): tenant + first key + default ABAC
     * role + a set of data mounts, idempotently, in one call.
     */
    provision(input: ProvisionInput): Promise<ProvisionResult>;
}
/** Tenant registry CRUD + bootstrap (`/admin/v1/tenants`). Admin-only. */
export declare class TenantsClient {
    private readonly http;
    private readonly serviceRoleKey?;
    constructor(http: HttpClient, serviceRoleKey?: string | undefined);
    list(): Promise<Tenant[]>;
    create(input: TenantCreateInput): Promise<Tenant>;
    get(id: string): Promise<Tenant>;
    update(id: string, input: TenantUpdateInput): Promise<Tenant>;
    delete(id: string): Promise<{
        deleted: boolean;
    }>;
    /**
     * Wire up everything a new tenant needs in one call (default ABAC role +
     * first API key + optional default mount). Idempotent on re-bootstrap.
     */
    bootstrap(id: string, input?: TenantBootstrapInput): Promise<TenantBootstrapResult>;
    private request;
}
/**
 * Per-tenant schema migrations (`/admin/v1/migrate` → Rust data plane).
 * Admin-only. The request carries a signed identity envelope, the target mount
 * descriptor and ordered statements; the server applies them under an
 * idempotency marker.
 */
export declare class MigrateClient {
    private readonly http;
    private readonly serviceRoleKey?;
    constructor(http: HttpClient, serviceRoleKey?: string | undefined);
    run<TResult = unknown>(input: MigrateInput): Promise<TResult>;
}
