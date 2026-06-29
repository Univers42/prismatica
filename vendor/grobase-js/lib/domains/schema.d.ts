import type { HttpClient } from '../core/http.js';
import type { NormalizedSchema, SchemaDdlInput, SchemaDdlResult } from '../types.js';
/**
 * Engine-agnostic schema introspection + DDL
 * (`GET /query/v1/:dbId/schema`, `POST /query/v1/:dbId/schema/ddl`).
 *
 * `describe()` returns the mount's tables/collections with normalized column
 * types plus the engine's live capability descriptor; `ddl()` applies ONE
 * schema operation per request. Engines without an introspection/DDL surface
 * (redis/http) reject with 422 `unsupported_capability`; an
 * `alter_column_type` the existing data cannot satisfy rejects with 409.
 */
export declare class SchemaClient {
    private readonly http;
    constructor(http: HttpClient);
    /** Describe `dbId`'s schema (tables, normalized columns, live capabilities). */
    describe(dbId: string): Promise<NormalizedSchema>;
    /**
     * Apply ONE schema-DDL operation to `dbId`. Destructive ops (`drop_column`,
     * `drop_table`) are refused **before any request is sent** unless
     * `confirm: true` — the same contract the server enforces with a 400.
     */
    ddl(dbId: string, input: SchemaDdlInput): Promise<SchemaDdlResult>;
}
