// Public API for programmatic use of ccinit
export { scanProject } from "./scanner/index.js";
export {
  generateConfig,
  generateClaudeMd,
  generateSettings,
  generateCommands,
} from "./generator/index.js";
export type {
  ProjectProfile,
  GeneratedConfig,
  McpRecommendation,
  FrameworkInfo,
  DetectedCommand,
  Language,
} from "./scanner/types.js";
