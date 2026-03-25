import type { ProjectProfile, McpRecommendation } from "../scanner/types.js";

/**
 * Determine MCP server recommendations based on project profile.
 * Conservative — only recommend well-known, real packages.
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

  return recs;
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
