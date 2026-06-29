/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   functions.ts                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/06/03 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/06/03 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
import { routes } from '../core/routes.js';
import { requireAdminKey } from '../core/admin.js';
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
export class FunctionsClient {
    http;
    serviceRoleKey;
    constructor(http, 
    /**
     * Service-role key for the admin-only A2 surfaces (triggers / schedules /
     * secrets). The deploy/invoke/list/get/delete methods do NOT need it; only
     * the `/admin/v1/function-*` operations do (internal-only at the gateway).
     */
    serviceRoleKey) {
        this.http = http;
        this.serviceRoleKey = serviceRoleKey;
    }
    /** List the calling tenant's deployed functions. */
    list() {
        return this.http.request(routes.functions.root, { method: 'GET' });
    }
    /** Deploy (create or overwrite) a function's source. */
    deploy(input) {
        return this.http.request(routes.functions.root, {
            method: 'POST',
            body: input,
        });
    }
    /** Fetch a function's source. */
    get(name) {
        return this.http.request(routes.functions.one(name), { method: 'GET' });
    }
    /** Remove a deployed function. */
    delete(name) {
        return this.http.request(routes.functions.one(name), { method: 'DELETE' });
    }
    /**
     * Invoke a deployed function by name and return its response body. The
     * runtime relays the function's own status + content type; a non-2xx status
     * surfaces as a {@link MiniBaasError}.
     */
    invoke(name, payload, options = {}) {
        return this.http.request(routes.functions.invoke(name), {
            method: options.method ?? 'POST',
            headers: options.headers,
            body: payload,
        });
    }
    // ── A2: DB-event -> function triggers (admin-only) ──────────────────────────
    /** Register a DB-event -> function trigger. **Requires `serviceRoleKey`.** */
    createTrigger(input) {
        return this.admin(routes.functions.triggers, 'POST', input);
    }
    /** List the calling tenant's function triggers. **Requires `serviceRoleKey`.** */
    listTriggers() {
        return this.admin(routes.functions.triggers, 'GET');
    }
    /** Delete a function trigger by id. **Requires `serviceRoleKey`.** */
    deleteTrigger(id) {
        return this.admin(routes.functions.trigger(id), 'DELETE');
    }
    // ── A2: scheduled (cron) invocation (admin-only) ────────────────────────────
    /** Register a scheduled function invocation. **Requires `serviceRoleKey`.** */
    createSchedule(input) {
        return this.admin(routes.functions.schedules, 'POST', input);
    }
    /** List the calling tenant's function schedules. **Requires `serviceRoleKey`.** */
    listSchedules() {
        return this.admin(routes.functions.schedules, 'GET');
    }
    /** Delete a function schedule by id. **Requires `serviceRoleKey`.** */
    deleteSchedule(id) {
        return this.admin(routes.functions.schedule(id), 'DELETE');
    }
    // ── A2: per-function secrets (admin-only) ───────────────────────────────────
    /** Set (upsert) a function secret. **Requires `serviceRoleKey`.** */
    setSecret(input) {
        return this.admin(routes.functions.secrets, 'POST', input);
    }
    /** List secret metadata (never plaintext). **Requires `serviceRoleKey`.** */
    listSecrets() {
        return this.admin(routes.functions.secrets, 'GET');
    }
    /**
     * Delete a function secret by key. Pass `functionName` to delete a
     * function-scoped secret; omit it for a tenant-wide one.
     * **Requires `serviceRoleKey`.**
     */
    deleteSecret(key, functionName) {
        const path = functionName
            ? `${routes.functions.secret(key)}?function_name=${encodeURIComponent(functionName)}`
            : routes.functions.secret(key);
        return this.admin(path, 'DELETE');
    }
    /** Shared request path for the admin-only A2 surfaces. */
    admin(path, method, body) {
        const key = requireAdminKey(this.serviceRoleKey, 'functions');
        return this.http.request(path, { method, body, apiKey: key, bearerToken: key });
    }
}
