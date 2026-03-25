import type { ProjectProfile, GeneratedConfig } from "../scanner/types.js";
import { generateClaudeMd } from "./claude-md.js";
import { generateSettings } from "./settings.js";
import { generateCommands } from "./commands.js";

/**
 * Generate all Claude Code configuration from a project profile.
 * Pure function — no file I/O. The CLI layer handles writing files.
 */
export function generateConfig(profile: ProjectProfile): GeneratedConfig {
  return {
    claudeMd: generateClaudeMd(profile),
    settings: generateSettings(profile),
    commands: generateCommands(profile),
  };
}

export { generateClaudeMd } from "./claude-md.js";
export { generateSettings } from "./settings.js";
export { generateCommands } from "./commands.js";
