/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   admin.ts                                           :+:      :+:    :+:   */
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
 * Privileged control-plane surface (`/admin/v1/*`).
 *
 * **Admin-only / server-side.** Every route here is internal-only at the
 * gateway (ip-restriction + an upstream service token); the client must be
 * constructed with a `serviceRoleKey`. Do NOT expose this to browser clients.
 */
export class AdminClient {
    http;
    serviceRoleKey;
    tenants;
    migrate;
    constructor(http, serviceRoleKey) {
        this.http = http;
        this.serviceRoleKey = serviceRoleKey;
        this.tenants = new TenantsClient(http, serviceRoleKey);
        this.migrate = new MigrateClient(http, serviceRoleKey);
    }
    /**
     * Declarative tenant-stack reconcile (G2): tenant + first key + default ABAC
     * role + a set of data mounts, idempotently, in one call.
     */
    provision(input) {
        const key = requireAdminKey(this.serviceRoleKey, 'provision');
        return this.http.request(routes.tenants.provision, {
            method: 'POST',
            body: input,
            apiKey: key,
            bearerToken: key,
        });
    }
}
/** Tenant registry CRUD + bootstrap (`/admin/v1/tenants`). Admin-only. */
export class TenantsClient {
    http;
    serviceRoleKey;
    constructor(http, serviceRoleKey) {
        this.http = http;
        this.serviceRoleKey = serviceRoleKey;
    }
    list() {
        return this.request(routes.tenants.root, 'GET');
    }
    create(input) {
        return this.request(routes.tenants.root, 'POST', input);
    }
    get(id) {
        return this.request(routes.tenants.one(id), 'GET');
    }
    update(id, input) {
        return this.request(routes.tenants.one(id), 'PATCH', input);
    }
    delete(id) {
        return this.request(routes.tenants.one(id), 'DELETE');
    }
    /**
     * Wire up everything a new tenant needs in one call (default ABAC role +
     * first API key + optional default mount). Idempotent on re-bootstrap.
     */
    bootstrap(id, input = {}) {
        return this.request(routes.tenants.bootstrap(id), 'POST', input);
    }
    request(path, method, body) {
        const key = requireAdminKey(this.serviceRoleKey, 'tenants');
        return this.http.request(path, { method, body, apiKey: key, bearerToken: key });
    }
}
/**
 * Per-tenant schema migrations (`/admin/v1/migrate` → Rust data plane).
 * Admin-only. The request carries a signed identity envelope, the target mount
 * descriptor and ordered statements; the server applies them under an
 * idempotency marker.
 */
export class MigrateClient {
    http;
    serviceRoleKey;
    constructor(http, serviceRoleKey) {
        this.http = http;
        this.serviceRoleKey = serviceRoleKey;
    }
    run(input) {
        const key = requireAdminKey(this.serviceRoleKey, 'migrate');
        return this.http.request(routes.migrate.run, {
            method: 'POST',
            body: input,
            apiKey: key,
            bearerToken: key,
        });
    }
}
