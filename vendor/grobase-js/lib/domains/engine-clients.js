/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   engine-clients.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/06/01 12:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/06/01 01:51:48 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
// Per-engine SDK clients (M10 — capabilities at the type level).
//
// The shape of each `EngineClient<E, Row>` is **derived from
// `ENGINE_CAPS[E]`** at the type level. Methods that the engine does not
// support are absent from the type — calling them is a *compile* error,
// not a runtime surprise.
//
// Example:
//
//   const pg    = client.engine<'postgresql', User>(dbId, 'users');
//   const mongo = client.engine<'mongodb',    User>(dbId, 'users');
//
//   await pg.list();              // ✅ pg.caps.read    === true
//   await pg.transaction(...);    // ✅ pg.caps.txIntra === true
//   await pg.upsert(...);         // ❌ COMPILE ERROR — postgresql.caps.upsert === false
//   await pg.subscribe(...);      // ❌ COMPILE ERROR — postgresql.caps.stream === false
//
//   await mongo.subscribe((doc) => console.log(doc));  // ✅ mongodb.caps.stream === true
//   await mongo.transaction(...); // ❌ COMPILE ERROR — mongodb.caps.txIntra === false
import { routes } from '../core/routes.js';
import { ENGINE_CAPS, } from '../generated/engines.js';
import { RealtimeClient } from './realtime-client.js';
/**
 * Runtime client implementation. The shape exposed to TypeScript is the
 * narrowed `EngineClient<E, Row>` — methods absent from that type are
 * simply not reachable at the type level even if they exist here.
 *
 * The cast `as EngineClient<E, Row>` is the *only* place we suppress the
 * structural mismatch: it is what binds the runtime adapter to the
 * compile-time capability narrowing.
 */
export function makeEngineClient(http, engine, databaseId, resource) {
    const caps = ENGINE_CAPS[engine];
    async function exec(action, payload) {
        const envelope = {
            database_id: databaseId,
            action,
            resource,
            payload,
        };
        const response = await http.request(routes.query.execute, {
            method: 'POST',
            body: envelope,
        });
        if (response && typeof response === 'object' && 'data' in response && response.data !== undefined) {
            return response.data;
        }
        if (response && typeof response === 'object' && 'rows' in response && response.rows !== undefined) {
            return response.rows;
        }
        return response;
    }
    const base = {
        list: (opts) => exec('list', opts),
        get: async (filter) => {
            const rows = await exec('get', { filter });
            return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        },
        insert: (data) => exec('insert', { data }),
        update: (filter, data) => exec('update', { filter, data }),
        delete: (filter) => exec('delete', { filter }),
    };
    const mixins = { engine, caps };
    if (caps.upsert) {
        mixins.upsert = (data) => exec('upsert', { data });
    }
    if (caps.stream) {
        const realtime = new RealtimeClient(http);
        // Channel naming mirrors the realtime engine's producer prefix:
        //   PG  → `pg.<schema>.<table>`   e.g. `pg.public.todos`
        //   Mongo → `mongo.<db>.<coll>`   e.g. `mongo.mini_baas.orders`
        // The `resource` arg is the bare table/collection name; the caller may
        // also pass an already-qualified name (e.g. `public.todos`) and it will
        // be sent through as-is.
        mixins.subscribe = (handler, options) => realtime.subscribe({
            ...options,
            adapter: engine,
            channel: resource,
            onEvent: (evt) => handler({ type: evt.event, row: evt.row }),
        });
    }
    if (caps.txIntra) {
        mixins.transaction = async (fn) => {
            // Single-statement transactional semantics are deferred to the gateway
            // (Idempotency-Key replay + ABAC decision happen there). For now we run
            // the body against the same client — multi-statement TX is M10.b.
            return fn(base);
        };
    }
    return { ...base, ...mixins };
}
