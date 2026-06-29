/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   webhooks.ts                                        :+:      :+:    :+:   */
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
 * Tenant-scoped webhook subscription registry (`/admin/v1/webhooks`).
 *
 * **Admin-only / server-side.** This surface is internal-only at the gateway
 * (ip-restriction + service token); callers must construct the client with a
 * `serviceRoleKey`. Never ship a webhook secret to a browser. Secrets are
 * write-only and are never returned by `list`/`get`.
 */
export class WebhooksClient {
    http;
    serviceRoleKey;
    constructor(http, serviceRoleKey) {
        this.http = http;
        this.serviceRoleKey = serviceRoleKey;
    }
    /** List the calling tenant's webhook subscriptions. */
    list() {
        return this.request(routes.webhooks.root, 'GET');
    }
    /** Create a webhook subscription. */
    create(input) {
        return this.request(routes.webhooks.root, 'POST', input);
    }
    /** Fetch a single subscription by id. */
    get(id) {
        return this.request(routes.webhooks.one(id), 'GET');
    }
    /** Patch a subscription. */
    update(id, input) {
        return this.request(routes.webhooks.one(id), 'PATCH', input);
    }
    /** Delete a subscription. */
    delete(id) {
        return this.request(routes.webhooks.one(id), 'DELETE');
    }
    /** Read the recent delivery ledger for a subscription. */
    deliveries(id, limit = 50) {
        return this.request(`${routes.webhooks.deliveries(id)}?limit=${limit}`, 'GET');
    }
    request(path, method, body) {
        const key = requireAdminKey(this.serviceRoleKey, 'webhooks');
        return this.http.request(path, { method, body, apiKey: key, bearerToken: key });
    }
}
