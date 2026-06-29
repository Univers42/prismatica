/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   txn.ts                                             :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: dlesieur <dlesieur@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/06/03 00:00:00 by dlesieur          #+#    #+#             */
/*   Updated: 2026/06/03 00:00:00 by dlesieur         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
import { routes } from '../core/routes.js';
/**
 * Single-mount atomic write batches (`POST /query/v1/txn`).
 *
 * Every operation runs inside one backend transaction on `databaseId` and
 * commits all-or-nothing (rolled back on the first failure). The target engine
 * must be transactional (postgresql/mysql); other engines are rejected by the
 * server. Cross-mount atomicity (2PC) is a different problem and not offered.
 */
export class TxnClient {
    http;
    constructor(http) {
        this.http = http;
    }
    /** Run 1–50 write ops atomically against a single mount. */
    execute(input) {
        return this.http.request(routes.query.txn, {
            method: 'POST',
            body: {
                mount: input.databaseId,
                operations: input.operations,
            },
        });
    }
}
