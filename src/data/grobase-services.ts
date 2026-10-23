// The real grobase service graph, extracted on 2026-10-20 with
// `docker compose --profile "*" config` in /opt/grobase. Ids, profiles and
// dependencies are facts from that snapshot, so the explorer can be rebuilt on
// the actual backend instead of the invented cost/latency numbers.
// Descriptions come from the grobase architecture overview or the service's
// evident role; nothing here invents numbers or features.
// Pure data: no DOM access, the UI consumes these tables.

export type ServiceGroup = 'edge' | 'tools' | 'core' | 'control' | 'data' | 'engines' | 'ops';

export interface GrobaseService {
	id: string;
	name: string;
	group: ServiceGroup;
	kind: 'service' | 'job';
	parent?: string;
	profiles: string[];
	dependsOn: string[];
	desc: string;
}

export const GROUPS: { id: ServiceGroup; label: string; side: string }[] = [
	{ id: 'core', label: 'Application core', side: 'centre' },
	{ id: 'edge', label: 'Edge', side: 'driving' },
	{ id: 'tools', label: 'Studio and tools', side: 'driving' },
	{ id: 'control', label: 'Control plane', side: 'top' },
	{ id: 'data', label: 'Data plane', side: 'driven' },
	{ id: 'engines', label: 'Engines and storage', side: 'driven' },
	{ id: 'ops', label: 'Observability and ops', side: 'bottom' },
];

// `profiles: ['core']` marks a compose service that ships with no profile,
// i.e. it is always on; every other entry matches the compose snapshot.
export const SERVICES: GrobaseService[] = [
	// Application plane (TypeScript/NestJS).
	{ id: 'query-router', name: 'Query router', group: 'core', kind: 'service', profiles: ['adapter-plane'], dependsOn: ['adapter-registry-go', 'data-plane-router-rust', 'log-service', 'permission-engine', 'redis'], desc: 'Validates the caller and routes queries to the data plane.' },
	{ id: 'permission-engine', name: 'Permission engine', group: 'core', kind: 'service', profiles: ['adapter-plane', 'control-plane'], dependsOn: ['db-bootstrap'], desc: 'Policy decision point evaluating ABAC and RBAC rules.' },
	{ id: 'schema-service', name: 'Schema service', group: 'core', kind: 'service', profiles: ['control-plane'], dependsOn: ['adapter-registry-go'], desc: 'Serves schema definitions to the app plane.' },
	{ id: 'outbox-relay', name: 'Outbox relay', group: 'core', kind: 'service', profiles: ['legacy-node'], dependsOn: ['db-bootstrap', 'mongo', 'realtime', 'redis'], desc: 'Moves outbox events onto Redis Streams.' },
	{ id: 'mongo-api', name: 'Mongo API', group: 'core', kind: 'service', profiles: ['data-plane'], dependsOn: ['mongo'], desc: 'Backend API over the Mongo documents.' },
	{ id: 'storage-router', name: 'Storage router', group: 'core', kind: 'service', profiles: ['extras', 'storage'], dependsOn: ['minio'], desc: 'Routes storage access to MinIO.' },
	{ id: 'email-service', name: 'Email service', group: 'core', kind: 'service', profiles: ['legacy-node'], dependsOn: [], desc: 'Sends transactional email.' },
	{ id: 'newsletter-service', name: 'Newsletter service', group: 'core', kind: 'service', profiles: ['legacy-node'], dependsOn: ['db-bootstrap', 'email-service'], desc: 'Runs newsletter subscriptions and campaigns.' },
	{ id: 'session-service', name: 'Session service', group: 'core', kind: 'service', profiles: ['legacy-node'], dependsOn: ['db-bootstrap'], desc: 'Manages user session records.' },
	{ id: 'gdpr-service', name: 'GDPR service', group: 'core', kind: 'service', profiles: ['legacy-node'], dependsOn: ['db-bootstrap'], desc: 'Handles export and erasure requests.' },
	{ id: 'analytics-service', name: 'Analytics service', group: 'core', kind: 'service', profiles: ['analytics'], dependsOn: ['mongo'], desc: 'Collects product usage events.' },
	{ id: 'ai-service', name: 'AI service', group: 'core', kind: 'service', profiles: ['analytics'], dependsOn: ['mongo'], desc: 'Serves AI assistance for the apps.' },
	{ id: 'log-service', name: 'Log service', group: 'core', kind: 'service', profiles: ['legacy-node'], dependsOn: [], desc: 'Collects structured logs.' },
	// Edge.
	{ id: 'waf', name: 'WAF', group: 'edge', kind: 'service', profiles: ['core'], dependsOn: ['kong'], desc: 'Filters requests with nginx, ModSecurity and the OWASP rules.' },
	{ id: 'kong', name: 'Kong gateway', group: 'edge', kind: 'service', profiles: ['core'], dependsOn: ['gotrue', 'postgrest', 'realtime'], desc: 'API gateway enforcing key auth, CORS, rate limits and correlation ids.' },
	{ id: 'gotrue', name: 'GoTrue', group: 'edge', kind: 'service', profiles: ['core'], dependsOn: ['db-bootstrap', 'mailpit'], desc: 'Handles authentication and user sign-in.' },
	{ id: 'postgrest', name: 'PostgREST', group: 'edge', kind: 'service', profiles: ['core'], dependsOn: ['db-bootstrap', 'postgres'], desc: 'Serves REST endpoints over Postgres.' },
	{ id: 'realtime', name: 'Realtime', group: 'edge', kind: 'service', profiles: ['data-plane', 'realtime'], dependsOn: ['db-bootstrap', 'mongo-init'], desc: 'Fans change events out to WebSocket clients.' },
	// Studio and tooling.
	{ id: 'studio', name: 'Studio', group: 'tools', kind: 'service', profiles: ['extras', 'studio'], dependsOn: ['pg-meta', 'postgres'], desc: 'Web studio for browsing and editing Postgres.' },
	{ id: 'pg-meta', name: 'pg-meta', group: 'tools', kind: 'service', profiles: ['extras', 'studio'], dependsOn: ['postgres'], desc: 'Serves Postgres metadata to the studio.' },
	{ id: 'playground', name: 'Playground', group: 'tools', kind: 'service', profiles: ['playground'], dependsOn: ['kong'], desc: 'Nginx-hosted playground behind the gateway.' },
	{ id: 'vault42', name: 'Vault 42', group: 'tools', kind: 'service', profiles: ['vault42'], dependsOn: ['kong'], desc: 'Standalone vault demo behind the gateway.' },
	// Control plane (Go).
	{ id: 'adapter-registry-go', name: 'Adapter registry', group: 'control', kind: 'service', profiles: ['control-plane', 'go-control-plane'], dependsOn: ['pg-migrate'], desc: 'Credential vault decrypting mount DSNs with AES-256-GCM.' },
	{ id: 'tenant-control', name: 'Tenant control', group: 'control', kind: 'service', profiles: ['control-plane', 'go-control-plane'], dependsOn: ['pg-migrate', 'postgres'], desc: 'Issues tenants, API keys and the JWT bootstrap.' },
	{ id: 'webhook-dispatcher', name: 'Webhook dispatcher', group: 'control', kind: 'service', profiles: ['background', 'control-plane', 'go-control-plane'], dependsOn: ['pg-migrate', 'redis'], desc: 'Delivers HMAC-signed webhooks from a Redis stream.' },
	{ id: 'orchestrator', name: 'Orchestrator', group: 'control', kind: 'service', profiles: ['background', 'control-plane', 'go-control-plane'], dependsOn: ['pg-migrate'], desc: 'Runs background control-plane tasks.' },
	{ id: 'function-scheduler', name: 'Function scheduler', group: 'control', kind: 'service', profiles: ['functions'], dependsOn: ['pg-migrate'], desc: 'Schedules function runs for the runtime.' },
	{ id: 'vault', name: 'Vault', group: 'control', kind: 'service', profiles: ['secrets'], dependsOn: [], desc: 'Stores secrets for the services.' },
	{ id: 'supavisor', name: 'Supavisor', group: 'control', kind: 'service', profiles: ['extras', 'ops'], dependsOn: ['postgres'], desc: 'Pools Postgres client connections.' },
	// Data plane (Rust).
	{ id: 'data-plane-router-rust', name: 'Rust data plane', group: 'data', kind: 'service', profiles: ['adapter-plane', 'rust-data-plane'], dependsOn: [], desc: 'Executes queries on per-mount pools with in-process ABAC.' },
	{ id: 'functions-runtime', name: 'Functions runtime', group: 'data', kind: 'service', profiles: ['extras', 'functions'], dependsOn: [], desc: 'Runs tenant functions.' },
	{ id: 'debezium', name: 'Debezium', group: 'data', kind: 'service', profiles: ['analytics'], dependsOn: ['postgres', 'redis'], desc: 'Streams Postgres changes for analytics.' },
	{ id: 'trino', name: 'Trino', group: 'data', kind: 'service', profiles: ['analytics', 'extras'], dependsOn: ['iceberg-rest', 'mongo', 'mysql', 'postgres'], desc: 'Federates SQL across Postgres, MySQL and Mongo.' },
	{ id: 'iceberg-rest', name: 'Iceberg REST', group: 'data', kind: 'service', profiles: ['analytics', 'extras'], dependsOn: ['minio-iceberg-init'], desc: 'REST catalog for Iceberg tables in MinIO.' },
	// Engines and storage.
	{ id: 'postgres', name: 'PostgreSQL', group: 'engines', kind: 'service', profiles: ['core'], dependsOn: [], desc: 'Primary relational store for the stack.' },
	{ id: 'cockroach', name: 'CockroachDB', group: 'engines', kind: 'service', profiles: ['engines-extra'], dependsOn: [], desc: 'Distributed SQL database engine.' },
	{ id: 'mongo', name: 'MongoDB', group: 'engines', kind: 'service', profiles: ['data-plane'], dependsOn: ['mongo-keyfile'], desc: 'Document database engine.' },
	{ id: 'mysql', name: 'MySQL', group: 'engines', kind: 'service', profiles: ['analytics', 'data-plane', 'extras'], dependsOn: [], desc: 'Relational database engine.' },
	{ id: 'mariadb', name: 'MariaDB', group: 'engines', kind: 'service', profiles: ['engines-extra'], dependsOn: [], desc: 'Relational database engine.' },
	{ id: 'mssql', name: 'SQL Server', group: 'engines', kind: 'service', profiles: ['engines-extra'], dependsOn: [], desc: 'Relational engine running SQL Server.' },
	{ id: 'redis', name: 'Redis', group: 'engines', kind: 'service', profiles: ['core'], dependsOn: [], desc: 'Key-value store that also carries event streams.' },
	{ id: 'dynamodb-local', name: 'DynamoDB local', group: 'engines', kind: 'service', profiles: ['engines-extra'], dependsOn: [], desc: 'Local emulator of the DynamoDB API.' },
	{ id: 'minio', name: 'MinIO', group: 'engines', kind: 'service', profiles: ['extras', 'storage'], dependsOn: [], desc: 'S3-compatible object storage.' },
	// Observability and ops.
	{ id: 'prometheus', name: 'Prometheus', group: 'ops', kind: 'service', profiles: ['observability'], dependsOn: [], desc: 'Scrapes metrics from the services.' },
	{ id: 'grafana', name: 'Grafana', group: 'ops', kind: 'service', profiles: ['observability'], dependsOn: [], desc: 'Dashboards over Prometheus metrics.' },
	{ id: 'loki', name: 'Loki', group: 'ops', kind: 'service', profiles: ['observability'], dependsOn: [], desc: 'Stores and queries aggregated logs.' },
	{ id: 'promtail', name: 'Promtail', group: 'ops', kind: 'service', profiles: ['observability'], dependsOn: [], desc: 'Ships container logs into Loki.' },
	{ id: 'pg-backup', name: 'pg-backup', group: 'ops', kind: 'service', profiles: ['backups', 'ops'], dependsOn: ['minio', 'postgres'], desc: 'Dumps Postgres backups into MinIO.' },
	{ id: 'mailpit', name: 'Mailpit', group: 'ops', kind: 'service', profiles: ['core'], dependsOn: [], desc: 'Catches local SMTP mail for inspection.' },
	// One-off bootstrap jobs; group follows the parent service.
	{ id: 'db-bootstrap', name: 'db-bootstrap', group: 'engines', kind: 'job', parent: 'postgres', profiles: ['core'], dependsOn: ['postgres'], desc: 'Initialises the Postgres databases.' },
	{ id: 'pg-migrate', name: 'pg-migrate', group: 'engines', kind: 'job', parent: 'postgres', profiles: ['core'], dependsOn: ['db-bootstrap', 'gotrue', 'postgres'], desc: 'Applies schema migrations to Postgres.' },
	{ id: 'mongo-init', name: 'mongo-init', group: 'engines', kind: 'job', parent: 'mongo', profiles: ['data-plane'], dependsOn: ['mongo'], desc: 'One-off Mongo bootstrap job.' },
	{ id: 'mongo-keyfile', name: 'mongo-keyfile', group: 'engines', kind: 'job', parent: 'mongo', profiles: ['data-plane'], dependsOn: [], desc: 'Generates the Mongo replica keyfile once.' },
	{ id: 'minio-iceberg-init', name: 'Iceberg init', group: 'engines', kind: 'job', parent: 'minio', profiles: ['analytics', 'extras', 'storage'], dependsOn: ['minio'], desc: 'Prepares the MinIO buckets for Iceberg.' },
	{ id: 'vault-init', name: 'Vault init', group: 'control', kind: 'job', parent: 'vault', profiles: ['secrets'], dependsOn: ['vault'], desc: 'Bootstraps the Vault secrets once.' },
];

// Engines the data plane speaks. `service: null` means the engine is embedded
// in the data plane itself, so no compose service backs it.
export const ENGINES: { id: string; label: string; service: string | null }[] = [
	{ id: 'postgresql', label: 'PostgreSQL', service: 'postgres' },
	{ id: 'cockroachdb', label: 'CockroachDB', service: 'cockroach' },
	{ id: 'mongodb', label: 'MongoDB', service: 'mongo' },
	{ id: 'mysql', label: 'MySQL', service: 'mysql' },
	{ id: 'mariadb', label: 'MariaDB', service: 'mariadb' },
	{ id: 'mssql', label: 'SQL Server', service: 'mssql' },
	{ id: 'redis', label: 'Redis', service: 'redis' },
	{ id: 'dynamodb', label: 'DynamoDB', service: 'dynamodb-local' },
	{ id: 'sqlite', label: 'SQLite', service: null },
	{ id: 'http', label: 'HTTP APIs', service: null },
];

// The universal query path. The engine hop is not listed here; the graph
// logic inserts the selected engine after the data plane.
export const PIPELINE: { service: string; phase: 'request' | 'events'; label: string }[] = [
	{ service: 'waf', phase: 'request', label: 'Filters the request against OWASP rules' },
	{ service: 'kong', phase: 'request', label: 'Checks the API key and rate limit' },
	{ service: 'query-router', phase: 'request', label: "Validates the caller's identity" },
	{ service: 'permission-engine', phase: 'request', label: 'Returns the ABAC or RBAC decision' },
	{ service: 'adapter-registry-go', phase: 'request', label: "Decrypts the mount's credentials" },
	{ service: 'data-plane-router-rust', phase: 'request', label: 'Runs the operation on a pooled connection' },
	{ service: 'outbox-relay', phase: 'events', label: 'Emits the change event' },
	{ service: 'redis', phase: 'events', label: 'Carries the event on a stream' },
	{ service: 'webhook-dispatcher', phase: 'events', label: 'Delivers signed webhooks' },
];

export const PRESETS: { id: string; label: string; profiles: string[] }[] = [
	{ id: 'core', label: 'Core', profiles: ['core'] },
	{ id: 'query', label: 'Query plane', profiles: ['core', 'adapter-plane'] },
	{ id: 'governed', label: 'Governed', profiles: ['core', 'adapter-plane', 'control-plane', 'data-plane'] },
	{ id: 'everything', label: 'Everything', profiles: ['*'] },
];
