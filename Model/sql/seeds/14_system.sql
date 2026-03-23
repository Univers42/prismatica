-- ============================================================================
-- seeds/14_system.sql — Webhooks, Deliveries, Notifications, Policy Rules,
--                       File Uploads
-- ============================================================================
-- Platform system services: outbound webhook integrations, in-app
-- notifications for demo users, org-level ABAC policy rules, and
-- sample file uploads.
--
-- Depends on: 06_demo_org.sql (orgs, users)
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  WEBHOOKS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO webhooks (id, organization_id, name, url, secret_hash, headers, events, is_active, retry_count, retry_delay_ms, last_triggered_at, last_status, created_by) VALUES
    -- Acme: Slack integration for record changes
    ('70000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     'Slack — Record Notifications',
     'https://hooks.slack.com/services/T00000/B00001/xxxx',
     '$2b$10$mockWebhookSecret001',
     '{"Content-Type":"application/json"}',
     ARRAY['record.created','record.updated','record.deleted'],
     TRUE, 3, 2000,
     '2025-03-23T09:15:00Z', 'success',
     'c0000000-0000-0000-0000-000000000001'),

    -- Globex: Zapier automation for sync events
    ('70000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000002',
     'Zapier — Sync Automation',
     'https://hooks.zapier.com/hooks/catch/123456/abcdef/',
     '$2b$10$mockWebhookSecret002',
     '{"Content-Type":"application/json","X-Api-Key":"zap-demo-key"}',
     ARRAY['sync.completed','sync.failed','adapter.health_changed'],
     TRUE, 5, 5000,
     '2025-03-23T10:30:00Z', 'success',
     'c0000000-0000-0000-0000-000000000003'),

    -- Globex: Audit log webhook to SIEM
    ('70000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000002',
     'SIEM — Audit Events',
     'https://siem.globex-inc.com/api/webhooks/prismatica',
     '$2b$10$mockWebhookSecret003',
     '{"Content-Type":"application/json","Authorization":"Bearer siem-token-demo"}',
     ARRAY['member.added','member.removed','role.changed','dashboard.updated'],
     TRUE, 3, 1000,
     '2025-03-22T18:00:00Z', 'success',
     'c0000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

\echo '  ✓ Webhooks created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  WEBHOOK DELIVERIES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO webhook_deliveries (webhook_id, event_type, payload, response_status, response_body, attempt_number, delivered_at, duration_ms) VALUES
    -- Slack: record.created delivery (success)
    ('70000000-0000-0000-0000-000000000001',
     'record.created',
     '{"event":"record.created","collection":"Leads","record_id":"rec-001","data":{"name":"New Lead","email":"lead@example.com"}}',
     200, '{"ok":true}', 1, '2025-03-23T09:15:00Z', 340),

    -- Slack: record.updated delivery (success)
    ('70000000-0000-0000-0000-000000000001',
     'record.updated',
     '{"event":"record.updated","collection":"Deals","record_id":"rec-042","changes":{"stage":"negotiation"}}',
     200, '{"ok":true}', 1, '2025-03-23T09:20:00Z', 280),

    -- Zapier: sync.completed delivery (success)
    ('70000000-0000-0000-0000-000000000002',
     'sync.completed',
     '{"event":"sync.completed","adapter":"Q1 Transaction Upload","records_processed":156}',
     200, '{"status":"success","id":"zap-exec-001"}', 1, '2025-03-23T10:30:00Z', 520),

    -- Zapier: sync.failed delivery — first attempt failed, second succeeded
    ('70000000-0000-0000-0000-000000000002',
     'sync.failed',
     '{"event":"sync.failed","adapter":"Q1 Transaction Upload","error":"Connection timeout"}',
     502, 'Bad Gateway', 1, '2025-03-22T09:00:05Z', 30050),
    ('70000000-0000-0000-0000-000000000002',
     'sync.failed',
     '{"event":"sync.failed","adapter":"Q1 Transaction Upload","error":"Connection timeout"}',
     200, '{"status":"success","id":"zap-exec-002"}', 2, '2025-03-22T09:00:40Z', 480),

    -- SIEM: member.added delivery (success)
    ('70000000-0000-0000-0000-000000000003',
     'member.added',
     '{"event":"member.added","organization":"Globex Inc","user":"hank_martinez","invited_by":"grace_davis"}',
     200, '{"received":true}', 1, '2025-03-22T18:00:00Z', 190)
ON CONFLICT DO NOTHING;

\echo '  ✓ Webhook deliveries logged.'

-- ═══════════════════════════════════════════════════════════════════════════
--  NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO notifications (id, user_id, type, title, message, is_read, resource_type, resource_id, action_url) VALUES
    -- Eve (Acme): new lead notification
    ('71000000-0000-0000-0000-000000000001',
     'c0000000-0000-0000-0000-000000000001',
     'sync_complete', 'HubSpot sync completed',
     '47 records synced from HubSpot CRM. 12 new leads imported.',
     TRUE, 'adapter', '60000000-0000-0000-0000-000000000001',
     '/acme-corp/crm-system/sales-pipeline'),

    -- Eve: comment mention
    ('71000000-0000-0000-0000-000000000002',
     'c0000000-0000-0000-0000-000000000001',
     'mention', 'Frank mentioned you',
     'Frank mentioned you in a comment on Sales Pipeline dashboard.',
     FALSE, 'dashboard', '20000000-0000-0000-0000-000000000001',
     '/acme-corp/crm-system/sales-pipeline/dashboard/sales-overview'),

    -- Frank (Acme): share notification
    ('71000000-0000-0000-0000-000000000003',
     'c0000000-0000-0000-0000-000000000002',
     'share', 'Dashboard shared with you',
     'Eve shared "Sales Overview" dashboard with you.',
     TRUE, 'dashboard', '20000000-0000-0000-0000-000000000001',
     '/acme-corp/crm-system/sales-pipeline/dashboard/sales-overview'),

    -- Grace (Globex): sync failure alert
    ('71000000-0000-0000-0000-000000000004',
     'c0000000-0000-0000-0000-000000000003',
     'sync_complete', 'CDC sync partial failure',
     'Globex Production DB sync completed with 2 conflicts. Review required.',
     FALSE, 'adapter', '60000000-0000-0000-0000-000000000002',
     '/globex-inc/financial-analytics/quarterly-reports'),

    -- Hank (Globex): comment reply
    ('71000000-0000-0000-0000-000000000005',
     'c0000000-0000-0000-0000-000000000004',
     'comment', 'Grace replied to your comment',
     'Grace replied: "Let''s review the Q1 report data in our next meeting."',
     FALSE, 'dashboard', '20000000-0000-0000-0000-000000000003',
     '/globex-inc/financial-analytics/quarterly-reports/dashboard/financial-overview'),

    -- Iris: system welcome
    ('71000000-0000-0000-0000-000000000006',
     'c0000000-0000-0000-0000-000000000005',
     'system', 'Welcome to Prismatica!',
     'Your Iris Studio workspace is ready. Start by creating a collection or importing data.',
     TRUE, NULL, NULL,
     '/iris-studio/client-portfolio/design-projects'),

    -- Admin: system alert
    ('71000000-0000-0000-0000-000000000007',
     'a0000000-0000-0000-0000-000000000001',
     'system', 'Platform health check',
     'All 4 services healthy. Database connections: 4 active, 0 degraded.',
     TRUE, NULL, NULL,
     '/admin/health'),

    -- Support: new ticket
    ('71000000-0000-0000-0000-000000000008',
     'a0000000-0000-0000-0000-000000000002',
     'system', 'Support ticket #1042',
     'Acme Corp reported slow sync performance on HubSpot adapter.',
     FALSE, 'adapter', '60000000-0000-0000-0000-000000000001',
     '/admin/support/tickets/1042')
ON CONFLICT DO NOTHING;

\echo '  ✓ Notifications created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  POLICY RULES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO policy_rules (id, organization_id, name, description, resource_type, conditions, effect, priority, is_active, created_by) VALUES
    -- Globex: Deny viewers access to confidential collections
    ('72000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000002',
     'Restrict Confidential Collections',
     'Viewers cannot access collections marked as confidential.',
     'collection',
     '{"and":[{"attr":"user.role","op":"eq","val":"viewer"},{"attr":"resource.sensitivity","op":"eq","val":"confidential"}]}',
     'deny', 100, TRUE,
     'c0000000-0000-0000-0000-000000000003'),

    -- Globex: Allow finance dept to access billing resources
    ('72000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000002',
     'Finance Billing Access',
     'Finance department members can access all billing resources.',
     'billing',
     '{"and":[{"attr":"user.department","op":"eq","val":"finance"}]}',
     'allow', 50, TRUE,
     'c0000000-0000-0000-0000-000000000003'),

    -- Acme: Deny access outside business hours (demo — inactive)
    ('72000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000001',
     'Business Hours Only',
     'Restrict non-admin access to business hours (9 AM – 6 PM UTC). Currently disabled.',
     '*',
     '{"and":[{"attr":"user.role","op":"neq","val":"admin"},{"attr":"env.time_hour","op":"not_in","val":[9,10,11,12,13,14,15,16,17]}]}',
     'deny', 10, FALSE,
     'c0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

\echo '  ✓ Policy rules created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  FILE UPLOADS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO file_uploads (id, organization_id, filename, stored_name, mime_type, size_bytes, storage_path, storage_backend, uploaded_by) VALUES
    -- Acme: company logo
    ('73000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     'acme-corp-logo.svg',
     '73000000-0000-0000-0000-000000000001.svg',
     'image/svg+xml', 4280,
     '/uploads/d0000000-0000-0000-0000-000000000001/73000000-0000-0000-0000-000000000001.svg',
     'local',
     'c0000000-0000-0000-0000-000000000001'),

    -- Globex: Q1 transactions CSV (the uploaded data file)
    ('73000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000002',
     'transactions_q1_2025.csv',
     '73000000-0000-0000-0000-000000000002.csv',
     'text/csv', 245760,
     '/uploads/d0000000-0000-0000-0000-000000000002/73000000-0000-0000-0000-000000000002.csv',
     'local',
     'c0000000-0000-0000-0000-000000000003'),

    -- Globex: annual report PDF
    ('73000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000002',
     'globex-annual-report-2024.pdf',
     '73000000-0000-0000-0000-000000000003.pdf',
     'application/pdf', 3145728,
     '/uploads/d0000000-0000-0000-0000-000000000002/73000000-0000-0000-0000-000000000003.pdf',
     'local',
     'c0000000-0000-0000-0000-000000000003'),

    -- Iris: design mockup PNG
    ('73000000-0000-0000-0000-000000000004',
     'd0000000-0000-0000-0000-000000000003',
     'hero-section-mockup-v2.png',
     '73000000-0000-0000-0000-000000000004.png',
     'image/png', 1048576,
     '/uploads/d0000000-0000-0000-0000-000000000003/73000000-0000-0000-0000-000000000004.png',
     'local',
     'c0000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

\echo '  ✓ File uploads created.'
\echo '✓ System seeded (3 webhooks, 6 deliveries, 8 notifications, 3 policy rules, 4 files).'
