import type { HttpClient } from '../core/http.js';
import type { EngineId } from '../generated/engines.js';
/** Standard event envelope emitted by the realtime engine. */
export interface RealtimeEvent<Row = Record<string, unknown>> {
    /** Originating topic, e.g. `pg.public.todos` or `mongo.mini_baas.orders`. */
    readonly topic: string;
    /** Event type — `insert`, `update`, `delete`, or producer-specific. */
    readonly event: string;
    /** The row / document. Shape depends on the producer. */
    readonly row: Row;
    /** ISO timestamp the engine stamped the event. */
    readonly ts?: string;
}
/** A single member of a topic's presence set (mirrors the wire `PresenceMember`). */
export interface PresenceMember<Meta = Record<string, unknown>> {
    /** Stable per-connection id (string form of the server `ConnectionId`). */
    readonly connId: string;
    /** Authenticated subject (JWT `sub`) when the server knew one. */
    readonly userId?: string;
    /** Opaque per-member metadata supplied at `track()` time. */
    readonly meta: Meta;
}
/**
 * Handle returned by `subscribe()` — call `.unsubscribe()` to close cleanly.
 *
 * A5 adds ephemeral **broadcast** (client→client) and **presence** (who's
 * online) over the same connection:
 * - `broadcast(event, payload)` sends a `BROADCAST` frame; other subscribers of
 *   the same topic receive it via `onEvent` with `event === 'broadcast'`.
 * - `track(meta)` / `untrack()` join / leave the topic's presence set; changes
 *   are surfaced to `onPresence` (when provided).
 */
export interface RealtimeSubscription {
    unsubscribe(): Promise<void>;
    /** Send an ephemeral broadcast to every subscriber of this topic. */
    broadcast(event: string, payload?: unknown): void;
    /** Join (or refresh) the topic's presence set with optional metadata. */
    track(meta?: Record<string, unknown>): void;
    /** Leave the topic's presence set. */
    untrack(): void;
}
export interface RealtimeSubscribeOptions<Row> {
    /** Engine the subscription targets — `mongodb`, `cassandra`, `postgresql`, etc. */
    adapter: EngineId;
    /** Channel string the engine expects, e.g. `public.todos` (PG) or `orders` (Mongo). */
    channel: string;
    /** Override the topic pattern sent to realtime-agnostic. */
    topic?: string;
    /** Optional server-side filter expression. */
    filter?: Record<string, unknown>;
    /** Optional client-chosen subscription id. */
    subscriptionId?: string;
    /** AUTH_OK + SUBSCRIBED timeout. */
    timeoutMs?: number;
    /** Test/runtime override for platforms without a global WebSocket. */
    webSocket?: typeof WebSocket;
    /** Handler invoked for every matching event. */
    onEvent: (event: RealtimeEvent<Row>) => void;
    /** Optional handler for parse / transport errors (default: console.warn). */
    onError?: (error: Error) => void;
    /**
     * When `true` (or when `presenceMeta` is set), the client emits a `TRACK`
     * frame right after `SUBSCRIBED`, joining the topic's presence set. Presence
     * changes are delivered to {@link RealtimeSubscribeOptions.onPresence}.
     */
    presence?: boolean;
    /** Opaque metadata to publish for this member (implies `presence: true`). */
    presenceMeta?: Record<string, unknown>;
    /**
     * Handler invoked with the current member list whenever the topic's presence
     * set changes. Presence is single-node authoritative on the server; the list
     * reflects the emitting node's local members. See the realtime engine docs.
     */
    onPresence?: (members: PresenceMember[]) => void;
}
/**
 * Lazy WebSocket client. Each `subscribe()` call opens its own WS — keeping
 * connection scope local to the caller and matching the realtime engine's
 * per-connection subscription cap (200 by default).
 *
 * Uses the platform `WebSocket` global: present natively in browsers, Node 22+,
 * Deno, Bun. No bundled polyfill — keeps the SDK runtime-agnostic.
 */
export declare class RealtimeClient {
    private readonly http;
    constructor(http: HttpClient);
    subscribe<Row = Record<string, unknown>>(options: RealtimeSubscribeOptions<Row>): Promise<RealtimeSubscription>;
}
