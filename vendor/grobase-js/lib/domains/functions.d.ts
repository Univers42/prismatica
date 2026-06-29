import type { HttpClient } from '../core/http.js';
import type { FunctionDeployInput, FunctionDeployResult, FunctionInvokeOptions, FunctionScheduleCreateInput, FunctionSchedule, FunctionSecretMeta, FunctionSecretSetInput, FunctionSource, FunctionSummary, FunctionTrigger, FunctionTriggerCreateInput } from '../types.js';
/**
 * Edge functions (`/functions/v1`).
 *
 * Tenants deploy TS/JS source and invoke it by name; each invocation runs in a
 * sandboxed Deno worker on the runtime. Identity is taken from the gateway's
 * JWT-derived headers, so a regular (non-admin) authenticated client works.
 *
 * Note: the gateway sets `X-User-Id` (from JWT `sub`) but not a tenant header,
 * so the runtime namespaces functions per USER, not per tenant — two users in
 * one tenant get separate function sets. An anon-key-only caller (no JWT) is
 * rejected (401).
 */
export declare class FunctionsClient {
    private readonly http;
    /**
     * Service-role key for the admin-only A2 surfaces (triggers / schedules /
     * secrets). The deploy/invoke/list/get/delete methods do NOT need it; only
     * the `/admin/v1/function-*` operations do (internal-only at the gateway).
     */
    private readonly serviceRoleKey?;
    constructor(http: HttpClient, 
    /**
     * Service-role key for the admin-only A2 surfaces (triggers / schedules /
     * secrets). The deploy/invoke/list/get/delete methods do NOT need it; only
     * the `/admin/v1/function-*` operations do (internal-only at the gateway).
     */
    serviceRoleKey?: string | undefined);
    /** List the calling tenant's deployed functions. */
    list(): Promise<FunctionSummary[]>;
    /** Deploy (create or overwrite) a function's source. */
    deploy(input: FunctionDeployInput): Promise<FunctionDeployResult>;
    /** Fetch a function's source. */
    get(name: string): Promise<FunctionSource>;
    /** Remove a deployed function. */
    delete(name: string): Promise<{
        deleted: boolean;
    }>;
    /**
     * Invoke a deployed function by name and return its response body. The
     * runtime relays the function's own status + content type; a non-2xx status
     * surfaces as a {@link MiniBaasError}.
     */
    invoke<TResult = unknown, TPayload = unknown>(name: string, payload?: TPayload, options?: FunctionInvokeOptions): Promise<TResult>;
    /** Register a DB-event -> function trigger. **Requires `serviceRoleKey`.** */
    createTrigger(input: FunctionTriggerCreateInput): Promise<FunctionTrigger>;
    /** List the calling tenant's function triggers. **Requires `serviceRoleKey`.** */
    listTriggers(): Promise<FunctionTrigger[]>;
    /** Delete a function trigger by id. **Requires `serviceRoleKey`.** */
    deleteTrigger(id: string): Promise<{
        deleted: boolean;
    }>;
    /** Register a scheduled function invocation. **Requires `serviceRoleKey`.** */
    createSchedule(input: FunctionScheduleCreateInput): Promise<FunctionSchedule>;
    /** List the calling tenant's function schedules. **Requires `serviceRoleKey`.** */
    listSchedules(): Promise<FunctionSchedule[]>;
    /** Delete a function schedule by id. **Requires `serviceRoleKey`.** */
    deleteSchedule(id: string): Promise<{
        deleted: boolean;
    }>;
    /** Set (upsert) a function secret. **Requires `serviceRoleKey`.** */
    setSecret(input: FunctionSecretSetInput): Promise<FunctionSecretMeta>;
    /** List secret metadata (never plaintext). **Requires `serviceRoleKey`.** */
    listSecrets(): Promise<FunctionSecretMeta[]>;
    /**
     * Delete a function secret by key. Pass `functionName` to delete a
     * function-scoped secret; omit it for a tenant-wide one.
     * **Requires `serviceRoleKey`.**
     */
    deleteSecret(key: string, functionName?: string): Promise<{
        deleted: boolean;
    }>;
    /** Shared request path for the admin-only A2 surfaces. */
    private admin;
}
