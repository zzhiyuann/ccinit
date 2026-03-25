import type { ProjectProfile, McpRecommendation } from "../scanner/types.js";

/**
 * Determine MCP server recommendations based on project profile.
 * Conservative — only recommend well-known, published packages.
 */
function recommend(profile: ProjectProfile): McpRecommendation[] {
  const recs: McpRecommendation[] = [];

  // Git MCP for all projects with a git repo
  if (profile.hasGit) {
    recs.push({
      name: "git",
      reason: "Repository history and diff analysis",
      config: {
        command: "npx",
        args: ["-y", "@anthropic/mcp-git"],
      },
    });
  }

  // Filesystem MCP — useful for any project to browse and search files
  recs.push({
    name: "filesystem",
    reason: "File browsing and search across the project",
    config: {
      command: "npx",
      args: ["-y", "@anthropic/mcp-filesystem", "."],
    },
  });

  // Context7 — documentation lookup for any project with dependencies
  if (profile.frameworks.length > 0 || profile.language !== "unknown") {
    recs.push({
      name: "context7",
      reason: "Up-to-date documentation lookup for libraries and frameworks",
      config: {
        command: "npx",
        args: ["-y", "@upstash/context7-mcp@latest"],
      },
    });
  }

  // Database MCPs based on detected config files and frameworks
  if (hasDatabaseSignals(profile)) {
    recs.push({
      name: "postgres",
      reason: "Database schema inspection and query assistance",
      config: {
        command: "npx",
        args: ["-y", "@anthropic/mcp-postgres"],
        env: { POSTGRES_URL: "postgresql://localhost:5432/mydb" },
      },
    });
  }

  // Puppeteer for web projects — browser testing and screenshots
  if (isWebFrontend(profile)) {
    recs.push({
      name: "puppeteer",
      reason: "Browser automation, screenshots, and visual testing",
      config: {
        command: "npx",
        args: ["-y", "@anthropic/mcp-puppeteer"],
      },
    });
  }

  return recs;
}

/** Check if the project has database-related signals. */
function hasDatabaseSignals(profile: ProjectProfile): boolean {
  const dbConfigs = [
    "docker-compose.yml",
    "docker-compose.yaml",
    "knexfile.js",
    "knexfile.ts",
    "ormconfig.json",
    "ormconfig.ts",
    "prisma/schema.prisma",
    "database.yml",
    "alembic.ini",
  ];
  const hasDbConfig = profile.configFiles.some((f) =>
    dbConfigs.some((db) => f.includes(db)),
  );
  const hasDbFramework = profile.frameworks.some((f) =>
    ["Prisma", "TypeORM", "Sequelize", "Drizzle", "SQLAlchemy", "Django"].includes(f.name),
  );
  const hasDbDir = profile.directories.some((d) =>
    ["migrations", "prisma"].includes(d),
  );
  return hasDbConfig || hasDbFramework || hasDbDir;
}

/** Check if the project is a web frontend. */
function isWebFrontend(profile: ProjectProfile): boolean {
  return profile.frameworks.some(
    (f) =>
      f.category === "web" &&
      ["React", "Next.js", "Vue", "Nuxt", "Svelte", "SvelteKit", "Angular", "Astro"].includes(f.name),
  );
}

/**
 * Generate settings.local.json content with MCP server recommendations.
 * Returns null if no MCP servers are recommended.
 * Pure function — no file I/O.
 */
export function generateSettings(
  profile: ProjectProfile,
): Record<string, unknown> | null {
  const recs = recommend(profile);

  if (recs.length === 0) return null;

  const mcpServers: Record<string, unknown> = {};
  for (const rec of recs) {
    const entry: Record<string, unknown> = {
      command: rec.config.command,
      args: rec.config.args,
    };
    if (rec.config.env && Object.keys(rec.config.env).length > 0) {
      entry["env"] = rec.config.env;
    }
    mcpServers[rec.name] = entry;
  }

  return { mcpServers };
}
