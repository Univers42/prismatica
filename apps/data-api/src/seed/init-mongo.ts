/**
 * MongoDB initializer for data-api.
 *
 * On startup, creates collections + indexes using the native MongoDB driver
 * (no mongosh needed). Seeding is handled externally via `make db-init`.
 *
 * This eliminates the 177 MB mongosh dependency from the production image.
 */
import { getDb } from '../db/mongo.js';
import type { CreateIndexesOptions, IndexSpecification } from 'mongodb';

// ── Collection list ─────────────────────────────────────
const COLLECTIONS = [
  'collection_records',
  'dashboard_layouts',
  'view_configs',
  'user_preferences',
  'query_cache',
  'workflow_definitions',
  'workflow_executions',
  'global_settings',
  'audit_log',
  'sync_state',
  'connection_credentials',
  'abac_rule_conditions',
  'abac_user_attributes',
] as const;

// ── Index definitions ───────────────────────────────────
interface IndexDef {
  keys: IndexSpecification;
  options: CreateIndexesOptions;
}

const INDEXES: Record<string, IndexDef[]> = {
  collection_records: [
    { keys: { collection_id: 1, is_deleted: 1, created_at: -1 }, options: { name: 'idx_collection_records_main' } },
    { keys: { organization_id: 1, collection_id: 1 }, options: { name: 'idx_collection_records_org' } },
    { keys: { workspace_id: 1, collection_id: 1 }, options: { name: 'idx_collection_records_workspace' } },
    { keys: { is_deleted: 1, deleted_at: 1 }, options: { name: 'idx_collection_records_deleted', partialFilterExpression: { is_deleted: true } } },
  ],
  dashboard_layouts: [
    { keys: { dashboard_id: 1, scope: 1, owner_id: 1 }, options: { name: 'idx_layout_lookup', unique: true } },
    { keys: { owner_id: 1, scope: 1 }, options: { name: 'idx_layout_user', partialFilterExpression: { scope: 'personal' } } },
    { keys: { workspace_id: 1, scope: 1 }, options: { name: 'idx_layout_workspace' } },
    { keys: { organization_id: 1 }, options: { name: 'idx_layout_org' } },
  ],
  view_configs: [
    { keys: { view_id: 1, scope: 1, owner_id: 1 }, options: { name: 'idx_view_config_lookup', unique: true } },
    { keys: { owner_id: 1, scope: 1 }, options: { name: 'idx_view_config_user', partialFilterExpression: { scope: 'personal' } } },
    { keys: { collection_id: 1 }, options: { name: 'idx_view_config_collection' } },
    { keys: { workspace_id: 1 }, options: { name: 'idx_view_config_workspace' } },
  ],
  user_preferences: [
    { keys: { user_id: 1 }, options: { name: 'idx_user_preferences_user', unique: true } },
  ],
  query_cache: [
    { keys: { cache_key: 1 }, options: { name: 'idx_query_cache_key', unique: true } },
    { keys: { expires_at: 1 }, options: { name: 'idx_query_cache_ttl', expireAfterSeconds: 0 } },
    { keys: { collection_id: 1 }, options: { name: 'idx_query_cache_collection' } },
    { keys: { workspace_id: 1 }, options: { name: 'idx_query_cache_workspace' } },
    { keys: { widget_id: 1 }, options: { name: 'idx_query_cache_widget', partialFilterExpression: { widget_id: { $exists: true } } } },
  ],
  workflow_definitions: [
    { keys: { organization_id: 1, is_active: 1 }, options: { name: 'idx_workflow_def_org' } },
    { keys: { 'trigger.type': 1, 'trigger.collection_id': 1 }, options: { name: 'idx_workflow_def_trigger' } },
  ],
  workflow_executions: [
    { keys: { workflow_id: 1, started_at: -1 }, options: { name: 'idx_workflow_exec_workflow' } },
    { keys: { organization_id: 1, status: 1 }, options: { name: 'idx_workflow_exec_status' } },
    { keys: { status: 1, started_at: 1 }, options: { name: 'idx_workflow_exec_running', partialFilterExpression: { status: { $in: ['pending', 'running'] } } } },
  ],
  global_settings: [
    { keys: { scope_type: 1, scope_id: 1 }, options: { name: 'idx_global_settings_scope', unique: true } },
    { keys: { organization_id: 1, scope_type: 1 }, options: { name: 'idx_global_settings_org' } },
  ],
  audit_log: [
    { keys: { organization_id: 1, timestamp: -1 }, options: { name: 'idx_audit_org_time' } },
    { keys: { workspace_id: 1, timestamp: -1 }, options: { name: 'idx_audit_workspace_time' } },
    { keys: { actor_id: 1, timestamp: -1 }, options: { name: 'idx_audit_actor_time' } },
    { keys: { resource_type: 1, resource_id: 1, timestamp: -1 }, options: { name: 'idx_audit_resource' } },
    { keys: { organization_id: 1, action: 1, timestamp: -1 }, options: { name: 'idx_audit_action' } },
    { keys: { expires_at: 1 }, options: { name: 'idx_audit_ttl', expireAfterSeconds: 0 } },
    { keys: { request_id: 1 }, options: { name: 'idx_audit_request', partialFilterExpression: { request_id: { $exists: true } } } },
  ],
  sync_state: [
    { keys: { channel_id: 1 }, options: { name: 'idx_sync_state_channel', unique: true } },
    { keys: { organization_id: 1, health: 1 }, options: { name: 'idx_sync_state_org_health' } },
    { keys: { connection_id: 1 }, options: { name: 'idx_sync_state_connection' } },
    { keys: { pending_conflicts: -1 }, options: { name: 'idx_sync_state_conflicts', partialFilterExpression: { pending_conflicts: { $gt: 0 } } } },
  ],
  connection_credentials: [
    { keys: { connection_id: 1 }, options: { name: 'idx_cred_connection', unique: true } },
    { keys: { organization_id: 1, status: 1 }, options: { name: 'idx_cred_org_status' } },
    { keys: { expires_at: 1 }, options: { name: 'idx_cred_ttl', expireAfterSeconds: 0, partialFilterExpression: { expires_at: { $exists: true } } } },
  ],
  abac_rule_conditions: [
    { keys: { rule_id: 1 }, options: { name: 'idx_abac_rc_rule', unique: true } },
    { keys: { organization_id: 1 }, options: { name: 'idx_abac_rc_org' } },
    { keys: { organization_id: 1, rule_id: 1 }, options: { name: 'idx_abac_rc_org_rule' } },
  ],
  abac_user_attributes: [
    { keys: { user_id: 1, organization_id: 1 }, options: { name: 'idx_abac_ua_user_org', unique: true } },
    { keys: { user_id: 1 }, options: { name: 'idx_abac_ua_user' } },
    { keys: { organization_id: 1 }, options: { name: 'idx_abac_ua_org' } },
    { keys: { organization_id: 1, 'attributes.department': 1 }, options: { name: 'idx_abac_ua_department', partialFilterExpression: { 'attributes.department': { $exists: true } } } },
    { keys: { organization_id: 1, 'attributes.clearance_level': 1 }, options: { name: 'idx_abac_ua_clearance', partialFilterExpression: { 'attributes.clearance_level': { $exists: true } } } },
  ],
};

/**
 * Check if MongoDB collections are already set up.
 */
async function isMongoSetup(): Promise<boolean> {
  try {
    const db = getDb();
    const collections = await db.listCollections({ name: 'collection_records' }).toArray();
    return collections.length > 0;
  } catch {
    return false;
  }
}

/**
 * Create all collections (idempotent).
 */
async function createCollections(): Promise<void> {
  const db = getDb();
  const existing = (await db.listCollections().toArray()).map((c) => c.name);
  let created = 0;

  for (const name of COLLECTIONS) {
    if (existing.includes(name)) continue;
    await db.createCollection(name);
    created++;
  }

  console.log(`[data-api] MongoDB collections: ${created} created, ${COLLECTIONS.length - created} existed`);
}

/**
 * Create all indexes (idempotent — createIndex is a no-op if already exists).
 */
async function createIndexes(): Promise<void> {
  const db = getDb();
  let count = 0;

  for (const [collName, defs] of Object.entries(INDEXES)) {
    for (const { keys, options } of defs) {
      try {
        await db.collection(collName).createIndex(keys, options);
        count++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[data-api] WARN index ${options.name}: ${msg}`);
      }
    }
  }

  console.log(`[data-api] MongoDB indexes: ${count} ensured`);
}

/**
 * Initialize MongoDB: create collections + indexes.
 * Seeding is handled externally via `make db-init` (runs in mongo container).
 */
export async function initMongo(): Promise<void> {
  console.log('[data-api] Checking MongoDB state…');

  const setupDone = await isMongoSetup();
  if (!setupDone) {
    console.log('[data-api] Collections not found — creating…');
    await createCollections();
    await createIndexes();
    console.log('[data-api] MongoDB setup complete ✓');
    console.log('[data-api] Run `make db-init` to seed demo data');
  } else {
    console.log('[data-api] MongoDB collections exist ✓');
  }
}
