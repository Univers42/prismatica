-- ============================================================================
-- seeds/12_connectivity.sql — Database Connections, Provisioned DBs,
--                             Sync Channels, Sync Executions
-- ============================================================================
-- Sets up external database connections, managed database instances,
-- and CDC sync channels for demo organizations.
--
-- Depends on: 06_demo_org.sql, 08_collections.sql
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  PROVISIONED DATABASES
-- ═══════════════════════════════════════════════════════════════════════════

-- Iris Studio gets a free Supabase instance (freelancer without own DB)
INSERT INTO provisioned_databases (id, organization_id, name, provider, engine, tier, region, provider_config, provider_metadata, resource_limits, backup_config, status, provisioned_at, created_by) VALUES
    ('50000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000003',
     'iris-studio-db', 'supabase', 'postgresql', 'free', 'us-east-1',
     '{"project_id":"iris-studio-abc123"}',
     '{"instance_id":"supabase-iris-001","endpoint":"db.iris-studio-abc123.supabase.co","port":5432}',
     '{"cpu_cores":1,"memory_mb":512,"storage_gb":1,"iops":500}',
     '{"enabled":true,"frequency":"daily","retention_days":7}',
     'active', '2025-02-15T10:30:00Z',
     'c0000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

\echo '  ✓ Provisioned databases created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  DATABASE CONNECTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Globex: external PostgreSQL connection (user-owned public)
INSERT INTO database_connections (id, organization_id, project_id, name, slug, description, connection_type, engine, connection_config, health_status, is_readonly, created_by) VALUES
    ('51000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000002',
     'e0000000-0000-0000-0000-000000000002',
     'Globex Production DB', 'globex-prod-db',
     'Primary PostgreSQL database for Globex financial data.',
     'user_public', 'postgresql',
     '{"host":"db.globex-inc.com","port":5432,"database":"globex_prod","ssl_mode":"require","pool_size":10}',
     'healthy', TRUE,
     'c0000000-0000-0000-0000-000000000003')
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Globex: external MongoDB connection (user-owned SSH)
INSERT INTO database_connections (id, organization_id, project_id, name, slug, description, connection_type, engine, connection_config, network_config, health_status, created_by) VALUES
    ('51000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000002',
     'e0000000-0000-0000-0000-000000000002',
     'Globex Analytics Mongo', 'globex-analytics-mongo',
     'MongoDB cluster used for analytics raw data.',
     'user_ssh', 'mongodb',
     '{"host":"mongo-cluster.globex-inc.internal","port":27017,"database":"analytics","auth_source":"admin"}',
     '{"bastion_host":"bastion.globex-inc.com","bastion_port":22,"bastion_user":"tunnel"}',
     'healthy',
     'c0000000-0000-0000-0000-000000000003')
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Acme: external MySQL connection (user-owned public)
INSERT INTO database_connections (id, organization_id, project_id, name, slug, description, connection_type, engine, connection_config, health_status, created_by) VALUES
    ('51000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000001',
     'Acme Legacy CRM', 'acme-legacy-crm',
     'Legacy MySQL CRM database being migrated to Prismatica.',
     'user_public', 'mysql',
     '{"host":"mysql.acme-corp.com","port":3306,"database":"crm_legacy","ssl_mode":"preferred"}',
     'degraded',
     'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Iris Studio: managed Supabase connection
INSERT INTO database_connections (id, organization_id, project_id, name, slug, description, connection_type, engine, connection_config, provisioned_db_id, health_status, created_by) VALUES
    ('51000000-0000-0000-0000-000000000004',
     'd0000000-0000-0000-0000-000000000003',
     'e0000000-0000-0000-0000-000000000003',
     'Iris Managed DB', 'iris-managed-db',
     'Platform-provisioned Supabase PostgreSQL for Iris Studio.',
     'managed', 'postgresql',
     '{"host":"db.iris-studio-abc123.supabase.co","port":5432,"database":"postgres","ssl_mode":"require"}',
     '50000000-0000-0000-0000-000000000001',
     'healthy',
     'c0000000-0000-0000-0000-000000000005')
ON CONFLICT (organization_id, slug) DO NOTHING;

\echo '  ✓ Database connections created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  SYNC CHANNELS
-- ═══════════════════════════════════════════════════════════════════════════

-- Globex PG → Transactions collection (CDC realtime, bidirectional)
INSERT INTO sync_channels (id, connection_id, collection_id, source_schema, source_path, field_mappings, sync_mode, sync_direction, conflict_strategy, status, last_sync_at, is_active, created_by) VALUES
    ('52000000-0000-0000-0000-000000000001',
     '51000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000004',
     'public', 'financial_transactions',
     '{"txn_description":"description","txn_amount":"amount","txn_category":"category","txn_date":"date","txn_type":"type"}',
     'cdc_realtime', 'bidirectional', 'newest_wins',
     'active', '2025-03-23T10:30:00Z', TRUE,
     'c0000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- Acme Legacy MySQL → Leads collection (polling, inbound only)
INSERT INTO sync_channels (id, connection_id, collection_id, source_path, field_mappings, sync_mode, sync_direction, conflict_strategy, polling_interval_ms, status, last_sync_at, is_active, created_by) VALUES
    ('52000000-0000-0000-0000-000000000002',
     '51000000-0000-0000-0000-000000000003',
     '10000000-0000-0000-0000-000000000001',
     'crm_leads',
     '{"lead_name":"name","lead_email":"email","lead_phone":"phone","lead_status":"status","lead_source":"source"}',
     'polling', 'inbound', 'source_wins', 300000,
     'active', '2025-03-23T09:00:00Z', TRUE,
     'c0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

\echo '  ✓ Sync channels created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  SYNC EXECUTIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO sync_executions (channel_id, status, trigger_type, direction, records_processed, records_in, records_out, records_conflicted, records_failed, latency_ms, started_at, completed_at, duration_ms) VALUES
    -- Globex CDC sync executions
    ('52000000-0000-0000-0000-000000000001', 'success', 'cdc', 'inbound',
     45, 45, 0, 0, 0, 120,
     '2025-03-23T10:29:00Z', '2025-03-23T10:30:00Z', 60000),
    ('52000000-0000-0000-0000-000000000001', 'success', 'cdc', 'bidirectional',
     12, 8, 4, 0, 0, 85,
     '2025-03-22T15:00:00Z', '2025-03-22T15:01:00Z', 60000),
    ('52000000-0000-0000-0000-000000000001', 'partial', 'cdc', 'inbound',
     30, 28, 0, 2, 0, 200,
     '2025-03-21T10:00:00Z', '2025-03-21T10:02:00Z', 120000),
    -- Acme polling sync
    ('52000000-0000-0000-0000-000000000002', 'success', 'poll', 'inbound',
     24, 24, 0, 0, 0, 450,
     '2025-03-23T09:00:00Z', '2025-03-23T09:01:00Z', 60000),
    ('52000000-0000-0000-0000-000000000002', 'failed', 'poll', 'inbound',
     0, 0, 0, 0, 0, NULL,
     '2025-03-22T09:00:00Z', '2025-03-22T09:00:05Z', 5000)
ON CONFLICT DO NOTHING;

\echo '  ✓ Sync executions logged.'
\echo '✓ Connectivity seeded (provisioned DBs, connections, sync channels, executions).'
