#!/usr/bin/env node
export interface CliConfig {
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
}
/** Resolve the config file path ($GROBASE_CONFIG overrides the default). */
export declare function configPath(): string;
/** Load persisted config (returns {} when absent or unreadable). */
export declare function loadConfig(): CliConfig;
/** Persist config, creating the parent directory if needed. */
export declare function saveConfig(cfg: CliConfig): void;
/** Split a comma-separated option into a trimmed, non-empty array. */
export declare function csv(value: string | undefined): string[] | undefined;
/** Parse `--data` as JSON if it looks like JSON, else keep the raw string. */
export declare function parseData(value: string | undefined): unknown;
/** Parse argv into { command path, positionals, options }. Exported for tests. */
export declare function parseCli(argv: string[]): {
    positionals: string[];
    values: Record<string, string | boolean | undefined>;
};
