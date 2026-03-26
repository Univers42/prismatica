-- ============================================================================
-- seeds/13_adapters.sql — External Data Adapters, Mappings & Executions
-- ============================================================================
-- Sets up demo data adapters (REST API, CSV, Google Sheets), field mappings
-- to local collections, and execution history logs.
--
-- Depends on: 06_demo_org.sql, 08_collections.sql
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  ADAPTERS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO adapters (id, organization_id, name, adapter_type, connection_config, is_active, health_status, last_health_check, created_by) VALUES
    -- Acme: REST API adapter (HubSpot CRM import)
    ('60000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     'HubSpot CRM Import',
     'rest_api',
     '{"base_url":"https://api.hubapi.com/crm/v3","auth_type":"bearer","api_key_encrypted":"enc:hs-demo-key-001"}',
     TRUE, 'healthy', '2025-03-23T08:00:00Z',
     'c0000000-0000-0000-0000-000000000001'),

    -- Globex: CSV file adapter (quarterly CSV uploads)
    ('60000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000002',
     'Q1 Transaction Upload',
     'csv',
     '{"delimiter":",","has_header":true,"encoding":"utf-8","date_format":"YYYY-MM-DD"}',
     TRUE, 'healthy', '2025-03-20T14:00:00Z',
     'c0000000-0000-0000-0000-000000000003'),

    -- Iris: Google Sheets adapter (client brief tracking)
    ('60000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000003',
     'Client Briefs Sheet',
     'google_sheets',
     '{"spreadsheet_id":"1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms","sheet_name":"Briefs","auth_type":"oauth2","credentials_encrypted":"enc:gsheets-demo-cred-001"}',
     TRUE, 'healthy', '2025-03-22T16:30:00Z',
     'c0000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

\echo '  ✓ Adapters created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  ADAPTER MAPPINGS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO adapter_mappings (id, adapter_id, collection_id, source_path, field_mappings, transform_rules, sync_direction, sync_frequency, conflict_strategy, last_sync_at, last_sync_status) VALUES
    -- HubSpot contacts → Acme Leads collection
    ('61000000-0000-0000-0000-000000000001',
     '60000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000001',
     '/contacts',
     '{"firstname":"name","email":"email","phone":"phone","lifecyclestage":"status","hs_lead_status":"source"}',
     '{"email":{"lowercase":true},"phone":{"strip_whitespace":true}}',
     'inbound', '0 */4 * * *', 'source_wins',
     '2025-03-23T08:00:00Z', 'success'),

    -- HubSpot deals → Acme Deals collection
    ('61000000-0000-0000-0000-000000000002',
     '60000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000002',
     '/deals',
     '{"dealname":"name","amount":"amount","dealstage":"stage","pipeline":"pipeline","closedate":"expected_close"}',
     '{"amount":{"to_number":true},"expected_close":{"parse_date":"ISO8601"}}',
     'inbound', '0 */4 * * *', 'source_wins',
     '2025-03-23T08:00:00Z', 'success'),

    -- CSV upload → Globex Transactions collection
    ('61000000-0000-0000-0000-000000000003',
     '60000000-0000-0000-0000-000000000002',
     '10000000-0000-0000-0000-000000000004',
     'transactions_q1_2025.csv',
     '{"txn_description":"description","txn_amount":"amount","txn_category":"category","txn_date":"date","txn_type":"type"}',
     '{"amount":{"to_number":true,"multiply":100},"date":{"parse_date":"YYYY-MM-DD"}}',
     'inbound', NULL, 'source_wins',
     '2025-03-20T14:30:00Z', 'success'),

    -- Google Sheets → Iris Client Briefs collection
    ('61000000-0000-0000-0000-000000000004',
     '60000000-0000-0000-0000-000000000003',
     '10000000-0000-0000-0000-000000000006',
     'Briefs!A1:G100',
     '{"Client Name":"client_name","Project Title":"title","Status":"status","Budget":"budget","Deadline":"deadline","Notes":"notes"}',
     '{"budget":{"to_number":true},"deadline":{"parse_date":"YYYY-MM-DD"}}',
     'bidirectional', '0 */2 * * *', 'newest_wins',
     '2025-03-22T16:30:00Z', 'success')
ON CONFLICT DO NOTHING;

\echo '  ✓ Adapter mappings created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  ADAPTER EXECUTIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO adapter_executions (adapter_id, mapping_id, status, trigger_type, records_processed, records_created, records_updated, records_failed, error_log, started_at, completed_at, duration_ms) VALUES
    -- HubSpot contacts → Leads: recent successful sync
    ('60000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001',
     'success', 'scheduled', 47, 12, 35, 0, NULL,
     '2025-03-23T08:00:00Z', '2025-03-23T08:00:14Z', 14200),

    -- HubSpot deals → Deals: recent successful sync
    ('60000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002',
     'success', 'scheduled', 18, 3, 15, 0, NULL,
     '2025-03-23T08:00:15Z', '2025-03-23T08:00:22Z', 7400),

    -- HubSpot contacts: partial failure a day ago
    ('60000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001',
     'partial', 'scheduled', 50, 10, 38, 2,
     '[{"record_index":23,"error":"Invalid email format","field":"email"},{"record_index":41,"error":"Duplicate phone","field":"phone"}]',
     '2025-03-22T08:00:00Z', '2025-03-22T08:00:18Z', 18300),

    -- CSV upload: manual one-time import
    ('60000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000003',
     'success', 'manual', 156, 156, 0, 0, NULL,
     '2025-03-20T14:15:00Z', '2025-03-20T14:15:45Z', 45200),

    -- Google Sheets bidirectional sync
    ('60000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000004',
     'success', 'scheduled', 8, 2, 5, 1,
     '[{"record_index":6,"error":"Budget value not numeric","field":"budget"}]',
     '2025-03-22T16:30:00Z', '2025-03-22T16:30:08Z', 8100)
ON CONFLICT DO NOTHING;

\echo '  ✓ Adapter executions logged.'
\echo '✓ Adapters seeded (3 adapters, 4 mappings, 5 executions).'
