/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   realtime-client.ts                                 :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/06/01 13:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/06/01 01:40:54 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
/**
 * Lazy WebSocket client. Each `subscribe()` call opens its own WS — keeping
 * connection scope local to the caller and matching the realtime engine's
 * per-connection subscription cap (200 by default).
 *
 * Uses the platform `WebSocket` global: present natively in browsers, Node 22+,
 * Deno, Bun. No bundled polyfill — keeps the SDK runtime-agnostic.
 */
export class RealtimeClient {
    http;
    constructor(http) {
        this.http = http;
    }
    async subscribe(options) {
        const WebSocketImpl = options.webSocket ?? globalThis.WebSocket;
        if (!WebSocketImpl) {
            throw new Error('[mini-baas/realtime] global WebSocket not found. ' +
                'Use Node 22+, a browser, Deno, or Bun — or polyfill `ws`.');
        }
        const url = this.http.createRealtimeWsUrl();
        const ws = new WebSocketImpl(url.toString());
        const topic = options.topic ?? defaultTopic(options.adapter, options.channel);
        const subId = options.subscriptionId ?? `${options.adapter}:${options.channel}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
        const onError = options.onError ?? ((err) => console.warn('[mini-baas/realtime]', err.message));
        const wantsPresence = options.presence === true || options.presenceMeta !== undefined;
        await new Promise((resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => rejectBeforeReady(new Error(`[mini-baas/realtime] subscribe timeout for ${topic}`)), options.timeoutMs ?? 10_000);
            const rejectBeforeReady = (error) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timeout);
                tryClose(ws);
                reject(error);
            };
            const resolveReady = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timeout);
                resolve();
            };
            ws.addEventListener('open', () => {
                send(ws, { type: 'AUTH', token: this.http.getRealtimeAuthToken() });
            });
            ws.addEventListener('message', (message) => {
                const frame = parseMessage(message.data);
                if (!frame)
                    return;
                if (frame.type === 'AUTH_OK') {
                    send(ws, {
                        type: 'SUBSCRIBE',
                        sub_id: subId,
                        topic,
                        filter: options.filter,
                    });
                    return;
                }
                if (frame.type === 'SUBSCRIBED' && frame.sub_id === subId) {
                    if (wantsPresence) {
                        send(ws, { type: 'TRACK', topic, meta: options.presenceMeta ?? {} });
                    }
                    resolveReady();
                    return;
                }
                if (frame.type === 'EVENT' && frame.sub_id === subId) {
                    // Presence and broadcast both arrive as EVENT frames; route by the
                    // engine-stamped event_type so callers get typed callbacks.
                    if (frame.event?.event_type === 'presence') {
                        options.onPresence?.(parsePresence(frame.event.payload));
                        return;
                    }
                    options.onEvent(normalizeEvent(frame.event));
                    return;
                }
                if (frame.type === 'ERROR') {
                    const error = new Error(`[mini-baas/realtime] ${frame.code}: ${frame.message}`);
                    if (settled)
                        onError(error);
                    else
                        rejectBeforeReady(error);
                }
            });
            ws.addEventListener('error', () => {
                const error = new Error(`[mini-baas/realtime] WebSocket error at ${url.toString()}`);
                if (settled)
                    onError(error);
                else
                    rejectBeforeReady(error);
            });
            ws.addEventListener('close', () => {
                if (settled)
                    return;
                rejectBeforeReady(new Error('[mini-baas/realtime] WebSocket closed before subscription was ready'));
            });
        });
        let closed = false;
        let tracked = wantsPresence;
        return {
            broadcast: (event, payload = {}) => {
                if (closed || ws.readyState !== 1)
                    return;
                send(ws, { type: 'BROADCAST', topic, event, payload });
            },
            track: (meta = {}) => {
                if (closed || ws.readyState !== 1)
                    return;
                tracked = true;
                send(ws, { type: 'TRACK', topic, meta });
            },
            untrack: () => {
                if (closed || ws.readyState !== 1)
                    return;
                tracked = false;
                send(ws, { type: 'UNTRACK', topic });
            },
            unsubscribe: async () => {
                if (closed)
                    return;
                closed = true;
                if (ws.readyState === 1) {
                    if (tracked)
                        send(ws, { type: 'UNTRACK', topic });
                    send(ws, { type: 'UNSUBSCRIBE', sub_id: subId });
                }
                tryClose(ws);
            },
        };
    }
}
function defaultTopic(adapter, channel) {
    const normalizedChannel = channel.split('/').filter(Boolean).join('/').replaceAll('.', '/');
    if (adapter === 'mongodb')
        return `mongo/${normalizedChannel}/*`;
    if (adapter === 'postgresql')
        return `pg/${normalizedChannel}/*`;
    return `${adapter}/${normalizedChannel}/*`;
}
function send(ws, payload) {
    ws.send(JSON.stringify(payload));
}
function parseMessage(data) {
    const text = messageText(data);
    if (!text)
        return undefined;
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
function messageText(data) {
    if (typeof data === 'string')
        return data;
    if (data instanceof ArrayBuffer)
        return new TextDecoder().decode(data);
    if (ArrayBuffer.isView(data))
        return new TextDecoder().decode(data);
    return undefined;
}
/**
 * Parse a `presence` EVENT payload (`{ topic, members: [...] }`) into the
 * SDK's {@link PresenceMember} shape, tolerating absent fields.
 */
function parsePresence(payload) {
    const body = isRecord(payload) ? payload : {};
    const members = Array.isArray(body['members']) ? body['members'] : [];
    return members.filter(isRecord).map((m) => ({
        connId: stringValue(m['conn_id']) ?? '',
        userId: stringValue(m['user_id']),
        meta: (isRecord(m['meta']) ? m['meta'] : {}),
    }));
}
function normalizeEvent(event) {
    const payload = isRecord(event.payload) ? event.payload : { value: event.payload };
    const rowCandidate = payload['fullDocument'] ?? payload['row'] ?? payload['data'] ??
        (Array.isArray(payload['rows']) ? payload['rows'][0] : undefined) ?? payload['documentKey'] ?? payload;
    return {
        topic: event.topic ?? '',
        event: normalizeEventType(event.event_type ?? stringValue(payload['operation']) ?? stringValue(payload['op'])),
        row: (isRecord(rowCandidate) ? rowCandidate : { value: rowCandidate }),
        ts: event.timestamp,
    };
}
function normalizeEventType(value) {
    const normalized = (value ?? '').toLowerCase();
    if (normalized.endsWith('.delete') || normalized === 'delete' || normalized === 'deleted')
        return 'delete';
    if (normalized.endsWith('.update') || normalized === 'update' || normalized === 'updated')
        return 'update';
    if (normalized === 'replace' || normalized === 'replaced')
        return 'update';
    if (normalized.endsWith('.insert') || normalized === 'insert' || normalized === 'inserted')
        return 'insert';
    return value ?? 'insert';
}
function tryClose(ws) {
    if (ws.readyState === 0 || ws.readyState === 1) {
        ws.close(1000, 'client unsubscribed');
    }
}
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function stringValue(value) {
    return typeof value === 'string' ? value : undefined;
}
