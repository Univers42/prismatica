-- ============================================================================
-- seeds/15_user_extras.sql — OAuth, Sessions, Direct Permissions, Contacts,
--                            API Keys, ABAC Conditions
-- ============================================================================
-- Populates remaining user-related tables with demo data to ensure every
-- table in the schema has representative rows.
--
-- Depends on: 01_permissions.sql, 02_roles.sql, 05_users.sql
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  OAUTH ACCOUNTS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO oauth_accounts (id, user_id, provider, provider_id, access_token, refresh_token, token_expires_at) VALUES
    -- Eve (Acme CEO): logged in via 42 School OAuth
    ('80000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001',
     '42', '42-uid-10042',
     'enc:42-access-token-eve-demo',
     'enc:42-refresh-token-eve-demo',
     '2025-04-23T00:00:00Z'),

    -- Grace (Globex Admin): logged in via Google
    ('80000000-0000-0000-0000-000000000002',
     'c0000000-0000-0000-0000-000000000003',
     'google', 'google-uid-grace-112233',
     'enc:google-access-token-grace-demo',
     'enc:google-refresh-token-grace-demo',
     '2025-04-15T12:00:00Z'),

    -- Iris (Freelancer): logged in via GitHub
    ('80000000-0000-0000-0000-000000000003',
     'c0000000-0000-0000-0000-000000000005',
     'github', 'github-uid-iris-445566',
     'enc:github-access-token-iris-demo',
     'enc:github-refresh-token-iris-demo',
     '2025-05-01T00:00:00Z'),

    -- Admin: also has Google OAuth
    ('80000000-0000-0000-0000-000000000004',
     'a0000000-0000-0000-0000-000000000001',
     'google', 'google-uid-admin-998877',
     'enc:google-access-token-admin-demo',
     'enc:google-refresh-token-admin-demo',
     '2025-04-30T00:00:00Z')
ON CONFLICT (provider, provider_id) DO NOTHING;

\echo '  ✓ OAuth accounts created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  USER SESSIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, is_active, expires_at, last_activity_at) VALUES
    -- Admin: active session
    ('81000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001',
     '$2b$10$mockSessionHash_admin_active_001',
     '10.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/122.0',
     TRUE, '2025-03-24T00:00:00Z', '2025-03-23T11:30:00Z'),

    -- Eve: active session (desktop)
    ('81000000-0000-0000-0000-000000000002',
     'c0000000-0000-0000-0000-000000000001',
     '$2b$10$mockSessionHash_eve_active_001',
     '192.168.1.42', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/124.0',
     TRUE, '2025-03-24T00:00:00Z', '2025-03-23T10:45:00Z'),

    -- Eve: expired session (mobile — previous day)
    ('81000000-0000-0000-0000-000000000003',
     'c0000000-0000-0000-0000-000000000001',
     '$2b$10$mockSessionHash_eve_expired_002',
     '192.168.1.42', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3) AppleWebKit/605.1.15 Mobile/15E148',
     FALSE, '2025-03-22T23:59:59Z', '2025-03-22T18:00:00Z'),

    -- Grace: active session
    ('81000000-0000-0000-0000-000000000004',
     'c0000000-0000-0000-0000-000000000003',
     '$2b$10$mockSessionHash_grace_active_001',
     '172.16.0.55', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15',
     TRUE, '2025-03-24T00:00:00Z', '2025-03-23T11:00:00Z'),

    -- Iris: active session
    ('81000000-0000-0000-0000-000000000005',
     'c0000000-0000-0000-0000-000000000005',
     '$2b$10$mockSessionHash_iris_active_001',
     '203.0.113.15', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0',
     TRUE, '2025-03-24T00:00:00Z', '2025-03-23T09:30:00Z')
ON CONFLICT DO NOTHING;

\echo '  ✓ User sessions created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  DIRECT USER PERMISSIONS (overrides)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO user_permissions (id, user_id, permission_id, granted, granted_by, expires_at) VALUES
    -- Frank (Acme member): explicit DENY on organization:delete
    -- (safety: even if his role somehow grants it, explicit deny wins)
    ('82000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000002',
     (SELECT id FROM permissions WHERE name = 'organization:delete' LIMIT 1),
     FALSE,
     'c0000000-0000-0000-0000-000000000001',
     NULL),

    -- Hank (Globex member): temporary dashboard:manage for 30 days
    ('82000000-0000-0000-0000-000000000002',
     'c0000000-0000-0000-0000-000000000004',
     (SELECT id FROM permissions WHERE name = 'dashboard:manage' LIMIT 1),
     TRUE,
     'c0000000-0000-0000-0000-000000000003',
     '2025-04-23T00:00:00Z'),

    -- Support agent: explicit ALLOW on user:manage (beyond read-only role)
    ('82000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000002',
     (SELECT id FROM permissions WHERE name = 'user:manage' LIMIT 1),
     TRUE,
     'a0000000-0000-0000-0000-000000000001',
     NULL),

    -- Iris: explicit DENY on billing:manage (free tier user, no billing)
    ('82000000-0000-0000-0000-000000000004',
     'c0000000-0000-0000-0000-000000000005',
     (SELECT id FROM permissions WHERE name = 'billing:manage' LIMIT 1),
     FALSE,
     'a0000000-0000-0000-0000-000000000001',
     NULL)
ON CONFLICT (user_id, permission_id) DO NOTHING;

\echo '  ✓ Direct user permissions created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  CONTACTS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO contacts (id, user_id, contact_user_id, first_name, last_name, email, phone, metadata) VALUES
    -- Eve's contacts (Acme CEO)
    ('83000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000002',
     'Frank', 'Miller', 'frank.miller@acme-corp.com', '+1-555-0101',
     '{"company":"Acme Corp","role":"Developer","notes":"Co-founder, handles technical side"}'),
    ('83000000-0000-0000-0000-000000000002',
     'c0000000-0000-0000-0000-000000000001',
     NULL,
     'Sarah', 'Connor', 'sarah.connor@example.com', '+1-555-0199',
     '{"company":"External Consultant","notes":"Potential lead — follow up in April"}'),

    -- Grace's contacts (Globex admin)
    ('83000000-0000-0000-0000-000000000003',
     'c0000000-0000-0000-0000-000000000003',
     'c0000000-0000-0000-0000-000000000004',
     'Hank', 'Martinez', 'hank.martinez@globex-inc.com', '+1-555-0202',
     '{"company":"Globex Inc","role":"Analyst","department":"Finance"}'),
    ('83000000-0000-0000-0000-000000000004',
     'c0000000-0000-0000-0000-000000000003',
     NULL,
     'Emily', 'Chen', 'emily.chen@auditors.com', '+1-555-0303',
     '{"company":"Chen & Associates","role":"External Auditor","notes":"Annual audit contact"}'),

    -- Iris's contacts
    ('83000000-0000-0000-0000-000000000005',
     'c0000000-0000-0000-0000-000000000005',
     NULL,
     'Marcus', 'Webb', 'marcus.webb@startupxyz.com', '+44-20-7946-0958',
     '{"company":"StartupXYZ","role":"CEO","notes":"Client — hero section redesign project"}')
ON CONFLICT DO NOTHING;

\echo '  ✓ Contacts created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  API KEYS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO api_keys (id, user_id, name, key_hash, scopes, is_active, last_used_at, expires_at) VALUES
    -- Eve: CI/CD pipeline key (read-only collections)
    ('84000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001',
     'CI/CD Pipeline — Read Only',
     '$2b$10$mockApiKeyHash_eve_cicd_001',
     ARRAY['collection:read','view:read','dashboard:read'],
     TRUE, '2025-03-23T06:00:00Z', '2025-06-01T00:00:00Z'),

    -- Grace: Analytics export key
    ('84000000-0000-0000-0000-000000000002',
     'c0000000-0000-0000-0000-000000000003',
     'Analytics Data Export',
     '$2b$10$mockApiKeyHash_grace_export_001',
     ARRAY['collection:read','resource:read','adapter:read'],
     TRUE, '2025-03-22T14:00:00Z', '2025-12-31T23:59:59Z'),

    -- Admin: platform management key (full access)
    ('84000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000001',
     'Platform Admin API Key',
     '$2b$10$mockApiKeyHash_admin_full_001',
     ARRAY['user:manage','organization:manage','role:manage','billing:manage'],
     TRUE, '2025-03-23T11:00:00Z', NULL)
ON CONFLICT DO NOTHING;

\echo '  ✓ API keys created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  ABAC CONDITIONS (per-permission attribute-based access conditions)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO abac_conditions (id, permission_id, role_id, attribute_key, operator, attribute_value, logic_group) VALUES
    -- dashboard:read → ALL roles: cannot read deleted dashboards
    ('85000000-0000-0000-0000-000000000001',
     (SELECT id FROM permissions WHERE name = 'dashboard:read' LIMIT 1),
     NULL,
     'resource.status', 'neq', '"deleted"',
     'AND'),

    -- collection:update → org_member role: only if user's department matches collection owner dept
    ('85000000-0000-0000-0000-000000000002',
     (SELECT id FROM permissions WHERE name = 'collection:update' LIMIT 1),
     (SELECT id FROM roles WHERE name = 'org_member' AND scope = 'organization' LIMIT 1),
     'user.department', 'eq', '"$resource.department"',
     'AND'),

    -- adapter:manage → ALL roles: only during business hours
    ('85000000-0000-0000-0000-000000000003',
     (SELECT id FROM permissions WHERE name = 'adapter:manage' LIMIT 1),
     NULL,
     'env.time_hour', 'between', '[9, 18]',
     'AND'),

    -- billing:read → org_viewer: deny if subscription is enterprise (sensitive)
    ('85000000-0000-0000-0000-000000000004',
     (SELECT id FROM permissions WHERE name = 'billing:read' LIMIT 1),
     (SELECT id FROM roles WHERE name = 'org_viewer' AND scope = 'organization' LIMIT 1),
     'resource.plan_tier', 'neq', '"enterprise"',
     'AND')
ON CONFLICT DO NOTHING;

\echo '  ✓ ABAC conditions created.'
\echo '✓ User extras seeded (4 OAuth, 5 sessions, 4 direct perms, 5 contacts, 3 API keys, 4 ABAC conditions).'
