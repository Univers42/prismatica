-- ============================================================================
-- seeds/09_dashboards_views.sql — Dashboards, Views, Templates, Permissions
-- ============================================================================
-- Creates the presentation layer: dashboards, views, dashboard templates,
-- and their per-entity permissions.
--
-- Depends on: 08_collections.sql (collections, workspaces)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  DASHBOARDS
-- ═══════════════════════════════════════════════════════════════════════════

-- Acme / Sales Pipeline → Sales Overview dashboard
INSERT INTO dashboards (id, workspace_id, name, slug, description, icon, is_default, visibility, refresh_interval, created_by) VALUES
    ('20000000-0000-0000-0000-000000000001',
     'f0000000-0000-0000-0000-000000000001',
     'Sales Overview', 'sales-overview',
     'Sales KPIs, pipeline, and team performance.',
     '📊', TRUE, 'workspace', 300,
     'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- Acme / Sales Pipeline → Lead Funnel dashboard
INSERT INTO dashboards (id, workspace_id, name, slug, description, icon, is_default, visibility, created_by) VALUES
    ('20000000-0000-0000-0000-000000000002',
     'f0000000-0000-0000-0000-000000000001',
     'Lead Funnel', 'lead-funnel',
     'Lead conversion funnel and source analysis.',
     '🔄', FALSE, 'workspace',
     'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- Globex / Quarterly Reports → Financial Summary dashboard
INSERT INTO dashboards (id, workspace_id, name, slug, description, icon, is_default, visibility, refresh_interval, created_by) VALUES
    ('20000000-0000-0000-0000-000000000003',
     'f0000000-0000-0000-0000-000000000002',
     'Q4 Financial Summary', 'q4-financial-summary',
     'Quarterly financial overview with revenue and expense breakdowns.',
     '💰', TRUE, 'organization', 600,
     'c0000000-0000-0000-0000-000000000003')
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- Iris / Design Projects → Project Status dashboard
INSERT INTO dashboards (id, workspace_id, name, slug, description, icon, is_default, visibility, created_by) VALUES
    ('20000000-0000-0000-0000-000000000004',
     'f0000000-0000-0000-0000-000000000003',
     'Project Status', 'project-status',
     'Client project timelines and status.',
     '🎨', TRUE, 'workspace',
     'c0000000-0000-0000-0000-000000000005')
ON CONFLICT (workspace_id, slug) DO NOTHING;

\echo '  ✓ Dashboards created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  DASHBOARD PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO dashboard_permissions (dashboard_id, grantee_type, grantee_id, can_view, can_edit, can_publish, can_share, granted_by) VALUES
    -- Frank can view + edit Sales Overview
    ('20000000-0000-0000-0000-000000000001', 'user', 'c0000000-0000-0000-0000-000000000002', TRUE, TRUE, FALSE, FALSE, 'c0000000-0000-0000-0000-000000000001'),
    -- Hank can view Financial Summary
    ('20000000-0000-0000-0000-000000000003', 'user', 'c0000000-0000-0000-0000-000000000004', TRUE, FALSE, FALSE, FALSE, 'c0000000-0000-0000-0000-000000000003'),
    -- Support agent can view all (via role)
    ('20000000-0000-0000-0000-000000000001', 'user', 'a0000000-0000-0000-0000-000000000002', TRUE, FALSE, FALSE, FALSE, 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (dashboard_id, grantee_type, grantee_id) DO NOTHING;

\echo '  ✓ Dashboard permissions created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  DASHBOARD TEMPLATES
-- ═══════════════════════════════════════════════════════════════════════════

-- Global templates (organization_id IS NULL)
INSERT INTO dashboard_templates (id, organization_id, name, description, category, is_public, template_data, created_by) VALUES
    ('21000000-0000-0000-0000-000000000001',
     NULL,
     'Sales Dashboard Starter',
     'A starter template for sales teams with pipeline, revenue, and lead widgets.',
     'sales',
     TRUE,
     '{"widgets":[{"type":"kpi","title":"Total Revenue","source":"deals","metric":"sum:value"},{"type":"chart","title":"Pipeline Stages","source":"deals","group_by":"stage","chart_type":"bar"},{"type":"table","title":"Recent Leads","source":"leads","columns":["name","email","status","score"],"limit":10}],"layout":{"columns":3,"rows":2}}',
     'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO dashboard_templates (id, organization_id, name, description, category, is_public, template_data, created_by) VALUES
    ('21000000-0000-0000-0000-000000000002',
     NULL,
     'Financial Overview',
     'Financial reporting template with budget vs actual, expenses, and revenue trends.',
     'finance',
     TRUE,
     '{"widgets":[{"type":"chart","title":"Revenue vs Expenses","chart_type":"line","source":"transactions","group_by":"month"},{"type":"kpi","title":"Net Income","source":"transactions","metric":"sum:amount"},{"type":"table","title":"Budget Variance","source":"budget-items","columns":["item","allocated","spent","variance"]}],"layout":{"columns":2,"rows":2}}',
     'a0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Org-specific template
INSERT INTO dashboard_templates (id, organization_id, name, description, category, is_public, template_data, created_by) VALUES
    ('21000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000001',
     'Acme CRM Dashboard',
     'Custom CRM dashboard template for Acme Corp sales team.',
     'crm',
     FALSE,
     '{"widgets":[{"type":"kanban","title":"Deal Pipeline","source":"deals","group_by":"stage"},{"type":"chart","title":"Lead Sources","source":"leads","group_by":"source","chart_type":"pie"}],"layout":{"columns":2,"rows":1}}',
     'c0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

\echo '  ✓ Dashboard templates created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  VIEWS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO views (id, collection_id, workspace_id, name, slug, view_type, is_default, visibility, created_by) VALUES
    -- Leads views
    ('22000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
     'All Leads', 'all-leads', 'table', TRUE, 'workspace', 'c0000000-0000-0000-0000-000000000001'),
    ('22000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
     'Leads by Status', 'leads-by-status', 'kanban', FALSE, 'workspace', 'c0000000-0000-0000-0000-000000000001'),
    -- Deals views
    ('22000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
     'Deal Pipeline', 'deal-pipeline', 'kanban', TRUE, 'workspace', 'c0000000-0000-0000-0000-000000000001'),
    ('22000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
     'Deals Table', 'deals-table', 'table', FALSE, 'workspace', 'c0000000-0000-0000-0000-000000000001'),
    ('22000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
     'Close Timeline', 'close-timeline', 'calendar', FALSE, 'workspace', 'c0000000-0000-0000-0000-000000000001'),
    -- Transactions views
    ('22000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002',
     'All Transactions', 'all-transactions', 'table', TRUE, 'workspace', 'c0000000-0000-0000-0000-000000000003'),
    ('22000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002',
     'Expense Chart', 'expense-chart', 'chart', FALSE, 'workspace', 'c0000000-0000-0000-0000-000000000003'),
    -- Client Briefs views
    ('22000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000003',
     'Briefs Board', 'briefs-board', 'kanban', TRUE, 'workspace', 'c0000000-0000-0000-0000-000000000005'),
    ('22000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000003',
     'Briefs Gallery', 'briefs-gallery', 'gallery', FALSE, 'workspace', 'c0000000-0000-0000-0000-000000000005')
ON CONFLICT (collection_id, slug) DO NOTHING;

\echo '  ✓ Views created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  VIEW PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO view_permissions (view_id, grantee_type, grantee_id, can_view, can_edit, granted_by) VALUES
    ('22000000-0000-0000-0000-000000000001', 'user', 'c0000000-0000-0000-0000-000000000002', TRUE, TRUE, 'c0000000-0000-0000-0000-000000000001'),
    ('22000000-0000-0000-0000-000000000003', 'user', 'c0000000-0000-0000-0000-000000000002', TRUE, FALSE, 'c0000000-0000-0000-0000-000000000001'),
    ('22000000-0000-0000-0000-000000000006', 'user', 'c0000000-0000-0000-0000-000000000004', TRUE, FALSE, 'c0000000-0000-0000-0000-000000000003')
ON CONFLICT (view_id, grantee_type, grantee_id) DO NOTHING;

\echo '  ✓ View permissions created.'
\echo '✓ Dashboards, views, templates, and permissions seeded.'
