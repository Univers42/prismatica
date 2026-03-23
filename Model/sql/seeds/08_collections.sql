-- ============================================================================
-- seeds/08_collections.sql — Demo Collections, Fields, Field Options, Indices
-- ============================================================================
-- Creates dynamic data collections (the "Airtable-like" tables) within
-- each workspace, along with field definitions and options.
--
-- Depends on: 06_demo_org.sql (workspaces, users)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  COLLECTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Acme / Sales Pipeline workspace → Leads collection
INSERT INTO collections (id, workspace_id, name, slug, description, icon, color, is_system, record_count, created_by) VALUES
    ('10000000-0000-0000-0000-000000000001',
     'f0000000-0000-0000-0000-000000000001',
     'Leads', 'leads',
     'Sales leads and prospects tracking.',
     '🎯', '#EF4444', FALSE, 24,
     'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- Acme / Sales Pipeline workspace → Deals collection
INSERT INTO collections (id, workspace_id, name, slug, description, icon, color, is_system, record_count, created_by) VALUES
    ('10000000-0000-0000-0000-000000000002',
     'f0000000-0000-0000-0000-000000000001',
     'Deals', 'deals',
     'Active deals and opportunities.',
     '💰', '#F59E0B', FALSE, 12,
     'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- Acme / Sales Pipeline workspace → Companies collection
INSERT INTO collections (id, workspace_id, name, slug, description, icon, color, is_system, record_count, created_by) VALUES
    ('10000000-0000-0000-0000-000000000003',
     'f0000000-0000-0000-0000-000000000001',
     'Companies', 'companies',
     'Company directory and account management.',
     '🏢', '#3B82F6', FALSE, 18,
     'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- Globex / Quarterly Reports workspace → Transactions collection
INSERT INTO collections (id, workspace_id, name, slug, description, icon, color, is_system, record_count, created_by) VALUES
    ('10000000-0000-0000-0000-000000000004',
     'f0000000-0000-0000-0000-000000000002',
     'Transactions', 'transactions',
     'Financial transaction records.',
     '📊', '#10B981', FALSE, 150,
     'c0000000-0000-0000-0000-000000000003')
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- Globex / Quarterly Reports workspace → Budget Items collection
INSERT INTO collections (id, workspace_id, name, slug, description, icon, color, is_system, record_count, created_by) VALUES
    ('10000000-0000-0000-0000-000000000005',
     'f0000000-0000-0000-0000-000000000002',
     'Budget Items', 'budget-items',
     'Budget line items and allocations.',
     '💳', '#6366F1', FALSE, 35,
     'c0000000-0000-0000-0000-000000000003')
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- Iris / Design Projects workspace → Client Briefs collection
INSERT INTO collections (id, workspace_id, name, slug, description, icon, color, is_system, record_count, created_by) VALUES
    ('10000000-0000-0000-0000-000000000006',
     'f0000000-0000-0000-0000-000000000003',
     'Client Briefs', 'client-briefs',
     'Design briefs from clients.',
     '📝', '#8B5CF6', FALSE, 8,
     'c0000000-0000-0000-0000-000000000005')
ON CONFLICT (workspace_id, slug) DO NOTHING;

\echo '  ✓ Collections created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  FIELDS (columns for each collection)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Leads collection fields ─────────────────────────────────────────────────
INSERT INTO fields (id, collection_id, name, slug, field_type, is_required, is_unique, is_primary, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Name',      'name',     'text',         TRUE,  FALSE, TRUE,  0),
    ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Email',     'email',    'email',        TRUE,  TRUE,  FALSE, 1),
    ('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Phone',     'phone',    'phone',        FALSE, FALSE, FALSE, 2),
    ('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Status',    'status',   'select',       TRUE,  FALSE, FALSE, 3),
    ('11000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Source',    'source',   'select',       FALSE, FALSE, FALSE, 4),
    ('11000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Score',     'score',    'rating',       FALSE, FALSE, FALSE, 5),
    ('11000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Notes',     'notes',    'long_text',    FALSE, FALSE, FALSE, 6)
ON CONFLICT (collection_id, slug) DO NOTHING;

-- ── Deals collection fields ─────────────────────────────────────────────────
INSERT INTO fields (id, collection_id, name, slug, field_type, is_required, is_primary, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000002', 'Deal Name',  'deal_name',  'text',     TRUE,  TRUE,  0),
    ('11000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000002', 'Value',      'value',      'currency', TRUE,  FALSE, 1),
    ('11000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000002', 'Stage',      'stage',      'select',   TRUE,  FALSE, 2),
    ('11000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000002', 'Close Date', 'close_date', 'date',     FALSE, FALSE, 3),
    ('11000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000002', 'Probability','probability','percent',  FALSE, FALSE, 4)
ON CONFLICT (collection_id, slug) DO NOTHING;

-- ── Companies collection fields ─────────────────────────────────────────────
INSERT INTO fields (id, collection_id, name, slug, field_type, is_required, is_primary, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000003', 'Company Name','company_name','text',    TRUE,  TRUE,  0),
    ('11000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000003', 'Website',     'website',     'url',     FALSE, FALSE, 1),
    ('11000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000003', 'Industry',    'industry',    'select',  FALSE, FALSE, 2),
    ('11000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000003', 'Size',        'size',        'select',  FALSE, FALSE, 3),
    ('11000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000003', 'Address',     'address',     'long_text',FALSE, FALSE, 4)
ON CONFLICT (collection_id, slug) DO NOTHING;

-- ── Transactions collection fields ──────────────────────────────────────────
INSERT INTO fields (id, collection_id, name, slug, field_type, is_required, is_primary, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000030', '10000000-0000-0000-0000-000000000004', 'Description', 'description', 'text',     TRUE,  TRUE,  0),
    ('11000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000004', 'Amount',      'amount',      'currency', TRUE,  FALSE, 1),
    ('11000000-0000-0000-0000-000000000032', '10000000-0000-0000-0000-000000000004', 'Category',    'category',    'select',   TRUE,  FALSE, 2),
    ('11000000-0000-0000-0000-000000000033', '10000000-0000-0000-0000-000000000004', 'Date',        'date',        'date',     TRUE,  FALSE, 3),
    ('11000000-0000-0000-0000-000000000034', '10000000-0000-0000-0000-000000000004', 'Type',        'type',        'select',   TRUE,  FALSE, 4)
ON CONFLICT (collection_id, slug) DO NOTHING;

-- ── Budget Items fields ─────────────────────────────────────────────────────
INSERT INTO fields (id, collection_id, name, slug, field_type, is_required, is_primary, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000040', '10000000-0000-0000-0000-000000000005', 'Item',       'item',       'text',     TRUE,  TRUE,  0),
    ('11000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000005', 'Allocated',  'allocated',  'currency', TRUE,  FALSE, 1),
    ('11000000-0000-0000-0000-000000000042', '10000000-0000-0000-0000-000000000005', 'Spent',      'spent',      'currency', FALSE, FALSE, 2),
    ('11000000-0000-0000-0000-000000000043', '10000000-0000-0000-0000-000000000005', 'Department', 'department', 'select',   TRUE,  FALSE, 3)
ON CONFLICT (collection_id, slug) DO NOTHING;

-- ── Client Briefs fields ────────────────────────────────────────────────────
INSERT INTO fields (id, collection_id, name, slug, field_type, is_required, is_primary, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000050', '10000000-0000-0000-0000-000000000006', 'Title',       'title',       'text',      TRUE,  TRUE,  0),
    ('11000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000006', 'Client',      'client',      'text',      TRUE,  FALSE, 1),
    ('11000000-0000-0000-0000-000000000052', '10000000-0000-0000-0000-000000000006', 'Brief',       'brief',       'rich_text', TRUE,  FALSE, 2),
    ('11000000-0000-0000-0000-000000000053', '10000000-0000-0000-0000-000000000006', 'Deadline',    'deadline',    'date',      FALSE, FALSE, 3),
    ('11000000-0000-0000-0000-000000000054', '10000000-0000-0000-0000-000000000006', 'Status',      'status',      'select',    TRUE,  FALSE, 4)
ON CONFLICT (collection_id, slug) DO NOTHING;

\echo '  ✓ Fields created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  FIELD OPTIONS (dropdown values for select fields)
-- ═══════════════════════════════════════════════════════════════════════════

-- Lead Status options
INSERT INTO field_options (field_id, label, value, color, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000004', 'New',          'new',          '#3B82F6', 0),
    ('11000000-0000-0000-0000-000000000004', 'Contacted',    'contacted',    '#F59E0B', 1),
    ('11000000-0000-0000-0000-000000000004', 'Qualified',    'qualified',    '#10B981', 2),
    ('11000000-0000-0000-0000-000000000004', 'Unqualified',  'unqualified',  '#EF4444', 3),
    ('11000000-0000-0000-0000-000000000004', 'Converted',    'converted',    '#8B5CF6', 4)
ON CONFLICT (field_id, value) DO NOTHING;

-- Lead Source options
INSERT INTO field_options (field_id, label, value, color, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000005', 'Website',  'website',  '#3B82F6', 0),
    ('11000000-0000-0000-0000-000000000005', 'Referral', 'referral', '#10B981', 1),
    ('11000000-0000-0000-0000-000000000005', 'LinkedIn', 'linkedin', '#0077B5', 2),
    ('11000000-0000-0000-0000-000000000005', 'Cold Call','cold_call','#F59E0B', 3),
    ('11000000-0000-0000-0000-000000000005', 'Event',   'event',    '#8B5CF6', 4)
ON CONFLICT (field_id, value) DO NOTHING;

-- Deal Stage options
INSERT INTO field_options (field_id, label, value, color, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000012', 'Prospecting', 'prospecting', '#3B82F6', 0),
    ('11000000-0000-0000-0000-000000000012', 'Discovery',   'discovery',   '#6366F1', 1),
    ('11000000-0000-0000-0000-000000000012', 'Proposal',    'proposal',    '#F59E0B', 2),
    ('11000000-0000-0000-0000-000000000012', 'Negotiation', 'negotiation', '#EF4444', 3),
    ('11000000-0000-0000-0000-000000000012', 'Closed Won',  'closed_won',  '#10B981', 4),
    ('11000000-0000-0000-0000-000000000012', 'Closed Lost', 'closed_lost', '#6B7280', 5)
ON CONFLICT (field_id, value) DO NOTHING;

-- Company Industry options
INSERT INTO field_options (field_id, label, value, color, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000022', 'Technology',   'technology',   '#3B82F6', 0),
    ('11000000-0000-0000-0000-000000000022', 'Finance',      'finance',      '#10B981', 1),
    ('11000000-0000-0000-0000-000000000022', 'Healthcare',   'healthcare',   '#EF4444', 2),
    ('11000000-0000-0000-0000-000000000022', 'Manufacturing','manufacturing','#F59E0B', 3),
    ('11000000-0000-0000-0000-000000000022', 'Retail',       'retail',       '#8B5CF6', 4)
ON CONFLICT (field_id, value) DO NOTHING;

-- Company Size options
INSERT INTO field_options (field_id, label, value, color, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000023', '1-10',     'micro',    '#10B981', 0),
    ('11000000-0000-0000-0000-000000000023', '11-50',    'small',    '#3B82F6', 1),
    ('11000000-0000-0000-0000-000000000023', '51-200',   'medium',   '#F59E0B', 2),
    ('11000000-0000-0000-0000-000000000023', '201-1000', 'large',    '#EF4444', 3),
    ('11000000-0000-0000-0000-000000000023', '1000+',    'enterprise','#8B5CF6', 4)
ON CONFLICT (field_id, value) DO NOTHING;

-- Transaction Category options
INSERT INTO field_options (field_id, label, value, color, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000032', 'Revenue',    'revenue',    '#10B981', 0),
    ('11000000-0000-0000-0000-000000000032', 'Expense',    'expense',    '#EF4444', 1),
    ('11000000-0000-0000-0000-000000000032', 'Investment', 'investment', '#3B82F6', 2),
    ('11000000-0000-0000-0000-000000000032', 'Transfer',   'transfer',   '#F59E0B', 3)
ON CONFLICT (field_id, value) DO NOTHING;

-- Transaction Type options
INSERT INTO field_options (field_id, label, value, color, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000034', 'Credit',    'credit',    '#10B981', 0),
    ('11000000-0000-0000-0000-000000000034', 'Debit',     'debit',     '#EF4444', 1),
    ('11000000-0000-0000-0000-000000000034', 'Adjustment','adjustment','#F59E0B', 2)
ON CONFLICT (field_id, value) DO NOTHING;

-- Budget Department options
INSERT INTO field_options (field_id, label, value, color, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000043', 'Engineering', 'engineering', '#3B82F6', 0),
    ('11000000-0000-0000-0000-000000000043', 'Marketing',   'marketing',   '#EF4444', 1),
    ('11000000-0000-0000-0000-000000000043', 'Sales',       'sales',       '#10B981', 2),
    ('11000000-0000-0000-0000-000000000043', 'Operations',  'operations',  '#F59E0B', 3),
    ('11000000-0000-0000-0000-000000000043', 'HR',          'hr',          '#8B5CF6', 4)
ON CONFLICT (field_id, value) DO NOTHING;

-- Client Brief Status options
INSERT INTO field_options (field_id, label, value, color, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000054', 'Received',     'received',     '#3B82F6', 0),
    ('11000000-0000-0000-0000-000000000054', 'In Progress',  'in_progress',  '#F59E0B', 1),
    ('11000000-0000-0000-0000-000000000054', 'Review',       'review',       '#6366F1', 2),
    ('11000000-0000-0000-0000-000000000054', 'Completed',    'completed',    '#10B981', 3),
    ('11000000-0000-0000-0000-000000000054', 'Cancelled',    'cancelled',    '#6B7280', 4)
ON CONFLICT (field_id, value) DO NOTHING;

\echo '  ✓ Field options created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  COLLECTION RELATIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Deals → Companies (many-to-one via a relation field)
INSERT INTO fields (id, collection_id, name, slug, field_type, is_required, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000002', 'Company', 'company', 'relation', FALSE, 5)
ON CONFLICT (collection_id, slug) DO NOTHING;

INSERT INTO collection_relations (id, source_collection_id, target_collection_id, source_field_id, relation_type, on_delete_action) VALUES
    ('12000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000002',  -- Deals
     '10000000-0000-0000-0000-000000000003',  -- Companies
     '11000000-0000-0000-0000-000000000015',  -- company field
     'one_to_many', 'set_null')
ON CONFLICT DO NOTHING;

-- Leads → Companies
INSERT INTO fields (id, collection_id, name, slug, field_type, is_required, sort_order) VALUES
    ('11000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'Company', 'company', 'relation', FALSE, 7)
ON CONFLICT (collection_id, slug) DO NOTHING;

INSERT INTO collection_relations (id, source_collection_id, target_collection_id, source_field_id, relation_type, on_delete_action) VALUES
    ('12000000-0000-0000-0000-000000000002',
     '10000000-0000-0000-0000-000000000001',  -- Leads
     '10000000-0000-0000-0000-000000000003',  -- Companies
     '11000000-0000-0000-0000-000000000008',  -- company field
     'one_to_many', 'set_null')
ON CONFLICT DO NOTHING;

\echo '  ✓ Collection relations created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  COLLECTION INDICES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO collection_indices (id, collection_id, name, field_slugs, is_unique, is_sparse) VALUES
    ('13000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'idx_leads_email',       '{"email"}',          TRUE,  FALSE),
    ('13000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'idx_leads_status',      '{"status"}',         FALSE, FALSE),
    ('13000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'idx_deals_stage',       '{"stage"}',          FALSE, FALSE),
    ('13000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'idx_transactions_date', '{"date","category"}',FALSE, FALSE)
ON CONFLICT DO NOTHING;

\echo '  ✓ Collection indices created.'
\echo '✓ Collections, fields, options, relations, and indices seeded.'
