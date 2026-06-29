import type { HttpClient } from '../core/http.js';
import type { WebhookCreateInput, WebhookDelivery, WebhookSubscription, WebhookUpdateInput } from '../types.js';
/**
 * Tenant-scoped webhook subscription registry (`/admin/v1/webhooks`).
 *
 * **Admin-only / server-side.** This surface is internal-only at the gateway
 * (ip-restriction + service token); callers must construct the client with a
 * `serviceRoleKey`. Never ship a webhook secret to a browser. Secrets are
 * write-only and are never returned by `list`/`get`.
 */
export declare class WebhooksClient {
    private readonly http;
    private readonly serviceRoleKey?;
    constructor(http: HttpClient, serviceRoleKey?: string | undefined);
    /** List the calling tenant's webhook subscriptions. */
    list(): Promise<WebhookSubscription[]>;
    /** Create a webhook subscription. */
    create(input: WebhookCreateInput): Promise<WebhookSubscription>;
    /** Fetch a single subscription by id. */
    get(id: string): Promise<WebhookSubscription>;
    /** Patch a subscription. */
    update(id: string, input: WebhookUpdateInput): Promise<WebhookSubscription>;
    /** Delete a subscription. */
    delete(id: string): Promise<{
        deleted: boolean;
    }>;
    /** Read the recent delivery ledger for a subscription. */
    deliveries(id: string, limit?: number): Promise<WebhookDelivery[]>;
    private request;
}
