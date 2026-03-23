-- ============================================================================
-- seeds/10_resources.sql — Universal Resource Registry, Permissions, Versions,
--                          Shares, Relations, Tags, Comments
-- ============================================================================
-- Registers dashboards, collections, and views in the polymorphic resource
-- system and adds permissions, versions, shares, tags, and comments.
--
-- Depends on: 08_collections.sql, 09_dashboards_views.sql
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  RESOURCES (universal registry)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO resources (id, organization_id, resource_type, resource_id, name, created_by) VALUES
    -- Acme dashboards
    ('30000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'dashboard', '20000000-0000-0000-0000-000000000001', 'Sales Overview', 'c0000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'dashboard', '20000000-0000-0000-0000-000000000002', 'Lead Funnel', 'c0000000-0000-0000-0000-000000000001'),
    -- Globex dashboard
    ('30000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'dashboard', '20000000-0000-0000-0000-000000000003', 'Q4 Financial Summary', 'c0000000-0000-0000-0000-000000000003'),
    -- Iris dashboard
    ('30000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'dashboard', '20000000-0000-0000-0000-000000000004', 'Project Status', 'c0000000-0000-0000-0000-000000000005'),
    -- Collections
    ('30000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000001', 'collection', '10000000-0000-0000-0000-000000000001', 'Leads', 'c0000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000001', 'collection', '10000000-0000-0000-0000-000000000002', 'Deals', 'c0000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000001', 'collection', '10000000-0000-0000-0000-000000000003', 'Companies', 'c0000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000002', 'collection', '10000000-0000-0000-0000-000000000004', 'Transactions', 'c0000000-0000-0000-0000-000000000003'),
    ('30000000-0000-0000-0000-000000000014', 'd0000000-0000-0000-0000-000000000002', 'collection', '10000000-0000-0000-0000-000000000005', 'Budget Items', 'c0000000-0000-0000-0000-000000000003'),
    ('30000000-0000-0000-0000-000000000015', 'd0000000-0000-0000-0000-000000000003', 'collection', '10000000-0000-0000-0000-000000000006', 'Client Briefs', 'c0000000-0000-0000-0000-000000000005'),
    -- Views
    ('30000000-0000-0000-0000-000000000020', 'd0000000-0000-0000-0000-000000000001', 'view', '22000000-0000-0000-0000-000000000001', 'All Leads', 'c0000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000001', 'view', '22000000-0000-0000-0000-000000000003', 'Deal Pipeline', 'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (resource_type, resource_id) DO NOTHING;

\echo '  ✓ Resources registered.'

-- ═══════════════════════════════════════════════════════════════════════════
--  RESOURCE PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO resource_permissions (resource_id, grantee_type, grantee_id, actions, granted_by) VALUES
    -- Frank can read + write Sales Overview dashboard resource
    ('30000000-0000-0000-0000-000000000001', 'user', 'c0000000-0000-0000-0000-000000000002', '{"read","write"}', 'c0000000-0000-0000-0000-000000000001'),
    -- Hank can read Financial Summary
    ('30000000-0000-0000-0000-000000000003', 'user', 'c0000000-0000-0000-0000-000000000004', '{"read"}', 'c0000000-0000-0000-0000-000000000003'),
    -- Public read on Leads collection
    ('30000000-0000-0000-0000-000000000010', 'organization', 'd0000000-0000-0000-0000-000000000001', '{"read"}', 'c0000000-0000-0000-0000-000000000001'),
    -- Support can read all Acme resources
    ('30000000-0000-0000-0000-000000000001', 'user', 'a0000000-0000-0000-0000-000000000002', '{"read"}', 'a0000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000010', 'user', 'a0000000-0000-0000-0000-000000000002', '{"read"}', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

\echo '  ✓ Resource permissions created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  RESOURCE VERSIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO resource_versions (resource_id, version_number, snapshot, change_summary, created_by) VALUES
    -- Sales Overview v1: initial creation
    ('30000000-0000-0000-0000-000000000001', 1,
     '{"name":"Sales Overview","widgets":["kpi_revenue","pipeline_chart"],"visibility":"workspace"}',
     'Initial dashboard creation with revenue KPI and pipeline chart.',
     'c0000000-0000-0000-0000-000000000001'),
    -- Sales Overview v2: added lead table
    ('30000000-0000-0000-0000-000000000001', 2,
     '{"name":"Sales Overview","widgets":["kpi_revenue","pipeline_chart","recent_leads_table"],"visibility":"workspace","refresh_interval":300}',
     'Added recent leads table widget and auto-refresh.',
     'c0000000-0000-0000-0000-000000000001'),
    -- Leads collection v1
    ('30000000-0000-0000-0000-000000000010', 1,
     '{"name":"Leads","fields":["name","email","phone","status","source"],"record_count":0}',
     'Initial collection creation with core fields.',
     'c0000000-0000-0000-0000-000000000001'),
    -- Leads collection v2: added score + notes
    ('30000000-0000-0000-0000-000000000010', 2,
     '{"name":"Leads","fields":["name","email","phone","status","source","score","notes"],"record_count":24}',
     'Added score and notes fields. 24 records imported.',
     'c0000000-0000-0000-0000-000000000001'),
    -- Financial Summary v1
    ('30000000-0000-0000-0000-000000000003', 1,
     '{"name":"Q4 Financial Summary","widgets":["revenue_vs_expenses","net_income","budget_variance"],"visibility":"organization"}',
     'Initial Q4 financial dashboard for Globex.',
     'c0000000-0000-0000-0000-000000000003')
ON CONFLICT (resource_id, version_number) DO NOTHING;

\echo '  ✓ Resource versions created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  RESOURCE SHARES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO resource_shares (id, resource_id, share_type, share_token, permissions, is_active, created_by) VALUES
    -- Public share link for Sales Overview
    ('31000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000001', 'link', 'share_acme_sales_overview_2025',
     '{"read"}', TRUE, 'c0000000-0000-0000-0000-000000000001'),
    -- Email share for Financial Summary to external auditor
    ('31000000-0000-0000-0000-000000000002',
     '30000000-0000-0000-0000-000000000003', 'email', 'share_globex_q4_audit_2025',
     '{"read"}', TRUE, 'c0000000-0000-0000-0000-000000000003'),
    -- Embeddable Leads view
    ('31000000-0000-0000-0000-000000000003',
     '30000000-0000-0000-0000-000000000020', 'embed', 'embed_acme_leads_view_2025',
     '{"read"}', TRUE, 'c0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

\echo '  ✓ Resource shares created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  RESOURCE RELATIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO resource_relations (source_resource_id, target_resource_id, relation_type, metadata) VALUES
    -- Sales Overview dashboard depends_on Leads collection
    ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000010', 'depends_on', '{"reason":"Leads widget data source"}'),
    -- Sales Overview dashboard depends_on Deals collection
    ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011', 'depends_on', '{"reason":"Pipeline chart data source"}'),
    -- Lead Funnel linked_to Sales Overview
    ('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'linked_to', '{"reason":"Companion dashboard"}'),
    -- All Leads view embedded_in Sales Overview dashboard
    ('30000000-0000-0000-0000-000000000020', '30000000-0000-0000-0000-000000000001', 'embedded_in', '{"widget":"recent_leads_table"}'),
    -- Deal Pipeline view embedded_in Sales Overview dashboard
    ('30000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000001', 'embedded_in', '{"widget":"pipeline_kanban"}')
ON CONFLICT (source_resource_id, target_resource_id, relation_type) DO NOTHING;

\echo '  ✓ Resource relations created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  TAGS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tags (id, organization_id, name, slug, color) VALUES
    -- Acme tags
    ('32000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Important',  'important',  '#EF4444'),
    ('32000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Sales',      'sales',      '#10B981'),
    ('32000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Q4 Review',  'q4-review',  '#F59E0B'),
    ('32000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'Automated',  'automated',  '#6366F1'),
    -- Globex tags
    ('32000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000002', 'Finance',    'finance',    '#10B981'),
    ('32000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000002', 'Confidential','confidential','#EF4444'),
    ('32000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000002', 'Audit Trail','audit-trail','#F59E0B'),
    -- Iris tags
    ('32000000-0000-0000-0000-000000000020', 'd0000000-0000-0000-0000-000000000003', 'Design',     'design',     '#8B5CF6'),
    ('32000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000003', 'Client',     'client',     '#3B82F6')
ON CONFLICT (organization_id, slug) DO NOTHING;

\echo '  ✓ Tags created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  RESOURCE TAGS (tag <-> resource associations)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO resource_tags (resource_id, tag_id) VALUES
    ('30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000002'),  -- Sales Overview → Sales
    ('30000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001'),  -- Sales Overview → Important
    ('30000000-0000-0000-0000-000000000010', '32000000-0000-0000-0000-000000000002'),  -- Leads → Sales
    ('30000000-0000-0000-0000-000000000011', '32000000-0000-0000-0000-000000000002'),  -- Deals → Sales
    ('30000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000010'),  -- Financial Summary → Finance
    ('30000000-0000-0000-0000-000000000003', '32000000-0000-0000-0000-000000000011'),  -- Financial Summary → Confidential
    ('30000000-0000-0000-0000-000000000004', '32000000-0000-0000-0000-000000000020'),  -- Project Status → Design
    ('30000000-0000-0000-0000-000000000015', '32000000-0000-0000-0000-000000000021')   -- Client Briefs → Client
ON CONFLICT DO NOTHING;

\echo '  ✓ Resource tags linked.'

-- ═══════════════════════════════════════════════════════════════════════════
--  COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO comments (id, resource_id, user_id, parent_id, content, is_resolved) VALUES
    -- Comment thread on Sales Overview dashboard
    ('33000000-0000-0000-0000-000000000001',
     '30000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', NULL,
     'Can we add a monthly trend chart for deal values?', FALSE),
    ('33000000-0000-0000-0000-000000000002',
     '30000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', '33000000-0000-0000-0000-000000000001',
     'Good idea! I will add it in the next iteration.', FALSE),
    -- Comment on Leads collection
    ('33000000-0000-0000-0000-000000000003',
     '30000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', NULL,
     'We should add a company relation field to link leads to companies.', TRUE),
    -- Comment on Financial Summary
    ('33000000-0000-0000-0000-000000000004',
     '30000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', NULL,
     'Q4 numbers look great. Ready for the board meeting.', FALSE),
    ('33000000-0000-0000-0000-000000000005',
     '30000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', '33000000-0000-0000-0000-000000000004',
     'I double-checked the reconciliation. All figures match the GL.', FALSE),
    -- Comment on Client Briefs
    ('33000000-0000-0000-0000-000000000006',
     '30000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000005', NULL,
     'Added the new brief from Stellar Corp. Deadline is tight!', FALSE)
ON CONFLICT DO NOTHING;

\echo '  ✓ Comments created.'
\echo '✓ Resources, permissions, versions, shares, tags, and comments seeded.'
