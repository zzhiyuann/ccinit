/** Languages the scanner can detect */
export type Language =
  | "typescript"
  | "javascript"
  | "python"
  | "rust"
  | "go"
  | "java"
  | "ruby"
  | "csharp"
  | "swift"
  | "unknown";

/** Detected framework information */
export interface FrameworkInfo {
  name: string;
  category: "web" | "api" | "cli" | "library" | "mobile" | "desktop" | "unknown";
}

/** A detected command (build, test, lint, etc.) */
export interface DetectedCommand {
  /** The command to run (e.g., "npm run build") */
  command: string;
  /** Where we found it (e.g., "package.json scripts.build") */
  source: string;
  /** Confidence 0-1 */
  confidence: number;
}

/** Complete profile of the scanned project */
export interface ProjectProfile {
  /** Project name (from package.json, Cargo.toml, etc.) */
  name: string;
  /** Primary language */
  language: Language;
  /** All detected languages */
  languages: Language[];
  /** Detected frameworks */
  frameworks: FrameworkInfo[];
  /** Package manager (npm, yarn, pnpm, pip, cargo, go, etc.) */
  packageManager: string | null;
  /** Build commands */
  buildCommands: DetectedCommand[];
  /** Test commands */
  testCommands: DetectedCommand[];
  /** Lint/format commands */
  lintCommands: DetectedCommand[];
  /** Dev/start commands */
  devCommands: DetectedCommand[];
  /** Key directories that exist */
  directories: string[];
  /** Key config files found */
  configFiles: string[];
  /** Whether the project has a git repo */
  hasGit: boolean;
  /** Whether CLAUDE.md already exists */
  hasClaudeMd: boolean;
  /** Monorepo detection */
  isMonorepo: boolean;
  /** Entry point files found */
  entryPoints: string[];
}

/** MCP server recommendation */
export interface McpRecommendation {
  /** npm package name or server identifier */
  name: string;
  /** Why this is recommended */
  reason: string;
  /** Configuration to add to settings */
  config: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
}

/** Complete output of ccinit */
export interface GeneratedConfig {
  /** CLAUDE.md content */
  claudeMd: string;
  /** settings.local.json content (MCP servers) */
  settings: Record<string, unknown> | null;
  /** Generated slash commands */
  commands: Array<{ name: string; content: string }>;
}
