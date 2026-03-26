-- ============================================================================
-- seeds/11_billing.sql — Subscriptions, Promotions, Invoices, Payments,
--                        Usage Records
-- ============================================================================
-- Sets up the billing lifecycle: promotions, subscriptions, invoices,
-- payments, and usage records for demo organizations.
--
-- Depends on: 03_plans.sql, 04_usage_meters.sql, 06_demo_org.sql
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
--  PROMOTIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO promotions (id, code, name, description, discount_type, discount_value, duration_months, max_redemptions, current_redemptions, starts_at, ends_at, is_active, created_by) VALUES
    ('40000000-0000-0000-0000-000000000001',
     'LAUNCH2025', 'Launch Promo 2025',
     '20% off for the first 3 months for early adopters.',
     'percentage', 20, 3, 100, 2,
     '2025-01-01T00:00:00Z', '2025-12-31T23:59:59Z',
     TRUE, 'a0000000-0000-0000-0000-000000000001'),
    ('40000000-0000-0000-0000-000000000002',
     'FREETRIAL14', 'Extended Free Trial',
     '14 extra trial days for referrals.',
     'trial_extension', 14, NULL, NULL, 1,
     '2025-01-01T00:00:00Z', NULL,
     TRUE, 'a0000000-0000-0000-0000-000000000001'),
    ('40000000-0000-0000-0000-000000000003',
     'ANNUAL50', 'Annual Discount $50',
     '$50 off annual subscriptions.',
     'fixed', 5000, 12, 50, 0,
     '2025-06-01T00:00:00Z', '2025-12-31T23:59:59Z',
     TRUE, 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (code) DO NOTHING;

\echo '  ✓ Promotions created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  PROMOTION ↔ PLAN ASSOCIATIONS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO promotion_plans (promotion_id, plan_id) VALUES
    -- LAUNCH2025 applies to starter and pro plans
    ('40000000-0000-0000-0000-000000000001', (SELECT id FROM plans WHERE slug = 'starter' LIMIT 1)),
    ('40000000-0000-0000-0000-000000000001', (SELECT id FROM plans WHERE slug = 'pro' LIMIT 1)),
    -- ANNUAL50 applies to pro only
    ('40000000-0000-0000-0000-000000000003', (SELECT id FROM plans WHERE slug = 'pro' LIMIT 1))
ON CONFLICT DO NOTHING;

\echo '  ✓ Promotion-plan associations created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  SUBSCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Acme Corp → Starter plan (monthly, using LAUNCH2025 promo)
INSERT INTO subscriptions (id, organization_id, plan_id, promotion_id, status, billing_period, current_period_start, current_period_end, trial_ends_at) VALUES
    ('41000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     (SELECT id FROM plans WHERE slug = 'starter' LIMIT 1),
     '40000000-0000-0000-0000-000000000001',
     'active', 'monthly',
     '2025-03-01T00:00:00Z', '2025-04-01T00:00:00Z',
     NULL)
ON CONFLICT DO NOTHING;

-- Globex Inc → Pro plan (yearly, no promo)
INSERT INTO subscriptions (id, organization_id, plan_id, promotion_id, status, billing_period, current_period_start, current_period_end) VALUES
    ('41000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000002',
     (SELECT id FROM plans WHERE slug = 'pro' LIMIT 1),
     NULL,
     'active', 'yearly',
     '2025-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
ON CONFLICT DO NOTHING;

-- Iris Studio → Free plan (monthly, extended trial)
INSERT INTO subscriptions (id, organization_id, plan_id, promotion_id, status, billing_period, current_period_start, current_period_end, trial_ends_at) VALUES
    ('41000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000003',
     (SELECT id FROM plans WHERE slug = 'free' LIMIT 1),
     '40000000-0000-0000-0000-000000000002',
     'trialing', 'monthly',
     '2025-03-01T00:00:00Z', '2025-04-01T00:00:00Z',
     '2025-03-28T00:00:00Z')
ON CONFLICT DO NOTHING;

\echo '  ✓ Subscriptions created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  INVOICES
-- ═══════════════════════════════════════════════════════════════════════════

-- Acme Corp — March invoice
INSERT INTO invoices (id, subscription_id, organization_id, invoice_number, status, subtotal_amount, discount_amount, tax_amount, total_amount, currency, period_start, period_end, due_date, paid_at, line_items) VALUES
    ('42000000-0000-0000-0000-000000000001',
     '41000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     'INV-2025-0001', 'paid',
     2900, 580, 0, 2320, 'USD',
     '2025-03-01T00:00:00Z', '2025-04-01T00:00:00Z',
     '2025-03-15T00:00:00Z', '2025-03-10T14:22:00Z',
     '[{"description":"Starter Plan (monthly)","amount":2900},{"description":"LAUNCH2025 (-20%)","amount":-580}]')
ON CONFLICT (organization_id, invoice_number) DO NOTHING;

-- Acme Corp — February invoice
INSERT INTO invoices (id, subscription_id, organization_id, invoice_number, status, subtotal_amount, discount_amount, tax_amount, total_amount, currency, period_start, period_end, due_date, paid_at, line_items) VALUES
    ('42000000-0000-0000-0000-000000000002',
     '41000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     'INV-2025-0002', 'paid',
     2900, 580, 0, 2320, 'USD',
     '2025-02-01T00:00:00Z', '2025-03-01T00:00:00Z',
     '2025-02-15T00:00:00Z', '2025-02-12T09:15:00Z',
     '[{"description":"Starter Plan (monthly)","amount":2900},{"description":"LAUNCH2025 (-20%)","amount":-580}]')
ON CONFLICT (organization_id, invoice_number) DO NOTHING;

-- Globex Inc — Annual invoice
INSERT INTO invoices (id, subscription_id, organization_id, invoice_number, status, subtotal_amount, discount_amount, tax_amount, total_amount, currency, period_start, period_end, due_date, paid_at, line_items) VALUES
    ('42000000-0000-0000-0000-000000000003',
     '41000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000002',
     'INV-2025-0001', 'paid',
     79900, 0, 0, 79900, 'USD',
     '2025-01-01T00:00:00Z', '2026-01-01T00:00:00Z',
     '2025-01-15T00:00:00Z', '2025-01-08T11:30:00Z',
     '[{"description":"Pro Plan (yearly)","amount":79900}]')
ON CONFLICT (organization_id, invoice_number) DO NOTHING;

-- Iris Studio — pending (trialing, no payment yet)
INSERT INTO invoices (id, subscription_id, organization_id, invoice_number, status, subtotal_amount, discount_amount, tax_amount, total_amount, currency, period_start, period_end, due_date, line_items) VALUES
    ('42000000-0000-0000-0000-000000000004',
     '41000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000003',
     'INV-2025-0001', 'draft',
     0, 0, 0, 0, 'USD',
     '2025-03-01T00:00:00Z', '2025-04-01T00:00:00Z',
     '2025-04-01T00:00:00Z',
     '[{"description":"Free Plan (monthly)","amount":0}]')
ON CONFLICT (organization_id, invoice_number) DO NOTHING;

\echo '  ✓ Invoices created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  PAYMENTS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO payments (id, invoice_id, organization_id, amount, currency, status, payment_method, gateway, external_payment_id) VALUES
    -- Acme March payment
    ('43000000-0000-0000-0000-000000000001',
     '42000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     2320, 'USD', 'succeeded', 'card', 'stripe', 'pi_acme_march_2025'),
    -- Acme February payment
    ('43000000-0000-0000-0000-000000000002',
     '42000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000001',
     2320, 'USD', 'succeeded', 'card', 'stripe', 'pi_acme_feb_2025'),
    -- Globex annual payment
    ('43000000-0000-0000-0000-000000000003',
     '42000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000002',
     79900, 'USD', 'succeeded', 'bank_transfer', 'stripe', 'pi_globex_annual_2025')
ON CONFLICT DO NOTHING;

\echo '  ✓ Payments created.'

-- ═══════════════════════════════════════════════════════════════════════════
--  USAGE RECORDS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO usage_records (organization_id, meter_id, quantity, metadata, recorded_at) VALUES
    -- Acme Corp usage
    ('d0000000-0000-0000-0000-000000000001', (SELECT id FROM usage_meters WHERE slug = 'storage_bytes' LIMIT 1),
     524288000, '{"note":"March snapshot"}', '2025-03-15T12:00:00Z'),
    ('d0000000-0000-0000-0000-000000000001', (SELECT id FROM usage_meters WHERE slug = 'record_count' LIMIT 1),
     54, '{"note":"March snapshot"}', '2025-03-15T12:00:00Z'),
    ('d0000000-0000-0000-0000-000000000001', (SELECT id FROM usage_meters WHERE slug = 'api_requests' LIMIT 1),
     12450, '{"note":"March total"}', '2025-03-15T12:00:00Z'),
    ('d0000000-0000-0000-0000-000000000001', (SELECT id FROM usage_meters WHERE slug = 'active_members' LIMIT 1),
     2, '{"note":"current gauge"}', '2025-03-15T12:00:00Z'),
    -- Globex Inc usage
    ('d0000000-0000-0000-0000-000000000002', (SELECT id FROM usage_meters WHERE slug = 'storage_bytes' LIMIT 1),
     2147483648, '{"note":"March snapshot"}', '2025-03-15T12:00:00Z'),
    ('d0000000-0000-0000-0000-000000000002', (SELECT id FROM usage_meters WHERE slug = 'record_count' LIMIT 1),
     185, '{"note":"March snapshot"}', '2025-03-15T12:00:00Z'),
    ('d0000000-0000-0000-0000-000000000002', (SELECT id FROM usage_meters WHERE slug = 'api_requests' LIMIT 1),
     87500, '{"note":"March total"}', '2025-03-15T12:00:00Z'),
    ('d0000000-0000-0000-0000-000000000002', (SELECT id FROM usage_meters WHERE slug = 'active_members' LIMIT 1),
     2, '{"note":"current gauge"}', '2025-03-15T12:00:00Z'),
    ('d0000000-0000-0000-0000-000000000002', (SELECT id FROM usage_meters WHERE slug = 'adapter_syncs' LIMIT 1),
     342, '{"note":"March total"}', '2025-03-15T12:00:00Z'),
    -- Iris Studio usage
    ('d0000000-0000-0000-0000-000000000003', (SELECT id FROM usage_meters WHERE slug = 'storage_bytes' LIMIT 1),
     104857600, '{"note":"March snapshot"}', '2025-03-15T12:00:00Z'),
    ('d0000000-0000-0000-0000-000000000003', (SELECT id FROM usage_meters WHERE slug = 'record_count' LIMIT 1),
     8, '{"note":"March snapshot"}', '2025-03-15T12:00:00Z'),
    ('d0000000-0000-0000-0000-000000000003', (SELECT id FROM usage_meters WHERE slug = 'api_requests' LIMIT 1),
     1200, '{"note":"March total"}', '2025-03-15T12:00:00Z')
ON CONFLICT DO NOTHING;

\echo '  ✓ Usage records created.'
\echo '✓ Billing lifecycle seeded (promotions, subscriptions, invoices, payments, usage).'
