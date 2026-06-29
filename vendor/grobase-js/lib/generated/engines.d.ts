export declare const ENGINE_CAPS: {
    readonly postgresql: {
        readonly read: true;
        readonly write: true;
        readonly upsert: false;
        readonly txIntra: true;
        readonly stream: false;
        readonly semantic: {
            readonly joins: "native";
            readonly patternSearch: "native";
            readonly ddl: true;
            readonly migrationVersioning: true;
            readonly latencyClass: "native";
        };
    };
    readonly mongodb: {
        readonly read: true;
        readonly write: true;
        readonly upsert: false;
        readonly txIntra: false;
        readonly stream: true;
        readonly semantic: {
            readonly joins: "limited";
            readonly patternSearch: "indexed";
            readonly ddl: true;
            readonly migrationVersioning: true;
            readonly latencyClass: "native";
        };
    };
    readonly mysql: {
        readonly read: true;
        readonly write: true;
        readonly upsert: true;
        readonly txIntra: true;
        readonly stream: false;
        readonly semantic: {
            readonly joins: "native";
            readonly patternSearch: "native";
            readonly ddl: true;
            readonly migrationVersioning: true;
            readonly latencyClass: "native";
        };
    };
    readonly redis: {
        readonly read: true;
        readonly write: true;
        readonly upsert: true;
        readonly txIntra: false;
        readonly stream: false;
        readonly semantic: {
            readonly joins: "none";
            readonly patternSearch: "none";
            readonly ddl: false;
            readonly migrationVersioning: false;
            readonly latencyClass: "adapter";
        };
    };
    readonly http: {
        readonly read: true;
        readonly write: true;
        readonly upsert: true;
        readonly txIntra: false;
        readonly stream: false;
        readonly semantic: {
            readonly joins: "none";
            readonly patternSearch: "none";
            readonly ddl: false;
            readonly migrationVersioning: false;
            readonly latencyClass: "adapter";
        };
    };
};
export type EngineId = keyof typeof ENGINE_CAPS;
export type EngineCaps<E extends EngineId = EngineId> = (typeof ENGINE_CAPS)[E];
export declare const ENGINE_IDS: EngineId[];
/** Engines that advertise `stream: true` (can be subscribed to). */
export type StreamableEngine = {
    [E in EngineId]: (typeof ENGINE_CAPS)[E]['stream'] extends true ? E : never;
}[EngineId];
/** Engines that advertise `txIntra: true` (support intra-engine transactions). */
export type TransactionalEngine = {
    [E in EngineId]: (typeof ENGINE_CAPS)[E]['txIntra'] extends true ? E : never;
}[EngineId];
/** Engines that advertise `upsert: true`. */
export type UpsertableEngine = {
    [E in EngineId]: (typeof ENGINE_CAPS)[E]['upsert'] extends true ? E : never;
}[EngineId];
/** Runtime introspection — keep this in lockstep with `EnginesController`. */
export interface EngineDescriptor {
    engine: EngineId;
    capabilities: EngineCaps;
}
export interface EnginesResponse {
    engines: EngineId[];
    details: EngineDescriptor[];
}
