import type { HttpClient } from '../core/http.js';
import { ENGINE_CAPS, type EngineCaps, type EngineId } from '../generated/engines.js';
import { type RealtimeSubscribeOptions, type RealtimeSubscription } from './realtime-client.js';
/** Always-on operations every engine in the catalog supports. */
export interface BaseEngineClient<Row = Record<string, unknown>> {
    /** List rows / documents matching `filter`. */
    list(opts?: {
        filter?: Record<string, unknown>;
        limit?: number;
        offset?: number;
    }): Promise<Row[]>;
    /** Fetch one by id-shaped filter. Returns `null` when not found. */
    get(filter: Record<string, unknown>): Promise<Row | null>;
    /** Insert one row. The server tags it with the calling `userId`. */
    insert(data: Partial<Row>): Promise<Row>;
    /** Update rows matching `filter`. Returns the rows that were updated. */
    update(filter: Record<string, unknown>, data: Partial<Row>): Promise<Row[]>;
    /** Delete rows matching `filter`. Returns the rows that were deleted. */
    delete(filter: Record<string, unknown>): Promise<Row[]>;
}
/** Mixed in when `caps.upsert === true`. */
export interface UpsertableMixin<Row> {
    /** Insert if missing, update if present. Native upsert path on the engine. */
    upsert(data: Partial<Row>): Promise<Row>;
}
/** Mixed in when `caps.stream === true`. */
export interface StreamableMixin<Row> {
    /**
     * Subscribe to a change stream / CDC feed via the realtime-agnostic engine.
     *
     * Opens a WebSocket to `/realtime/v1/ws` (routed by Kong → realtime:4000/ws),
     * sends `{action:'subscribe', channel, adapter}`, and dispatches every
     * incoming event to `handler`. Returns a handle whose `unsubscribe()` sends
     * the matching unsubscribe message and closes the socket cleanly.
     */
    subscribe(handler: (event: {
        type: 'insert' | 'update' | 'delete' | (string & {});
        row: Row;
    }) => void, options?: EngineSubscribeOptions<Row>): Promise<RealtimeSubscription>;
}
export type EngineSubscribeOptions<Row> = Omit<RealtimeSubscribeOptions<Row>, 'adapter' | 'channel' | 'onEvent'>;
/** Mixed in when `caps.txIntra === true`. */
export interface TransactionalMixin<Row> {
    /** Run `fn` inside an intra-engine transaction; commits if it resolves, rolls back if it throws. */
    transaction<T>(fn: (tx: BaseEngineClient<Row>) => Promise<T>): Promise<T>;
}
/**
 * The final, capability-derived shape exposed to user code.
 *
 * Use as `EngineClient<'postgresql', MyRow>`. The type intersection is
 * computed at compile time from `ENGINE_CAPS[E]` — missing capabilities
 * leave the mixin out, so calling them is a hard compile error.
 */
export type EngineClient<E extends EngineId, Row = Record<string, unknown>> = BaseEngineClient<Row> & ((typeof ENGINE_CAPS)[E]['upsert'] extends true ? UpsertableMixin<Row> : {}) & ((typeof ENGINE_CAPS)[E]['stream'] extends true ? StreamableMixin<Row> : {}) & ((typeof ENGINE_CAPS)[E]['txIntra'] extends true ? TransactionalMixin<Row> : {}) & {
    readonly engine: E;
    readonly caps: EngineCaps<E>;
};
/**
 * Runtime client implementation. The shape exposed to TypeScript is the
 * narrowed `EngineClient<E, Row>` — methods absent from that type are
 * simply not reachable at the type level even if they exist here.
 *
 * The cast `as EngineClient<E, Row>` is the *only* place we suppress the
 * structural mismatch: it is what binds the runtime adapter to the
 * compile-time capability narrowing.
 */
export declare function makeEngineClient<E extends EngineId, Row = Record<string, unknown>>(http: HttpClient, engine: E, databaseId: string, resource: string): EngineClient<E, Row>;
