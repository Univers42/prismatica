import type { HttpClient } from '../core/http.js';
import type { GraphqlQueryOptions, GraphqlResponse } from '../types.js';
/**
 * GraphQL client (`/graphql/v1`).
 *
 * Posts a GraphQL document + variables and returns the full
 * {@link GraphqlResponse} envelope (`data` and/or `errors`). The SDK does NOT
 * throw on GraphQL-level `errors` (those are part of a 200 response per the
 * GraphQL-over-HTTP spec); it only throws a {@link MiniBaasError} on a non-2xx
 * transport/auth status. Inspect `result.errors` yourself.
 */
export declare class GraphqlClient {
    private readonly http;
    constructor(http: HttpClient);
    /**
     * Execute a GraphQL `query` or `mutation` document.
     *
     * @example
     *   const res = await client.graphql.query<{ todosCollection: { edges: [] } }>(
     *     `query($first: Int!) { todosCollection(first: $first) { edges { node { id title } } } }`,
     *     { first: 10 },
     *   );
     *   if (res.errors) console.warn(res.errors);
     *   console.log(res.data?.todosCollection.edges);
     */
    query<Data = Record<string, unknown>, Variables = Record<string, unknown>>(document: string, variables?: Variables, options?: GraphqlQueryOptions): Promise<GraphqlResponse<Data>>;
}
