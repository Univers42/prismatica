import type { HttpClient } from '../core/http.js';
import type { TxnExecuteInput, TxnResult } from '../types.js';
/**
 * Single-mount atomic write batches (`POST /query/v1/txn`).
 *
 * Every operation runs inside one backend transaction on `databaseId` and
 * commits all-or-nothing (rolled back on the first failure). The target engine
 * must be transactional (postgresql/mysql); other engines are rejected by the
 * server. Cross-mount atomicity (2PC) is a different problem and not offered.
 */
export declare class TxnClient {
    private readonly http;
    constructor(http: HttpClient);
    /** Run 1–50 write ops atomically against a single mount. */
    execute(input: TxnExecuteInput): Promise<TxnResult>;
}
