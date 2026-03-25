import type { ProjectProfile, DetectedCommand } from "../scanner/types.js";

/** Pick the highest-confidence command. */
function best(cmds: DetectedCommand[]): string | undefined {
  if (cmds.length === 0) return undefined;
  return cmds.reduce((a, b) => (b.confidence > a.confidence ? b : a)).command;
}

/** Check if the project has a web framework. */
function isWebProject(profile: ProjectProfile): boolean {
  return profile.frameworks.some((f) => f.category === "web");
}

/**
 * Generate slash commands based on the project profile.
 * Returns an array of { name, content } to write as .claude/commands/{name}.md.
 * Pure function — no file I/O.
 */
export function generateCommands(
  profile: ProjectProfile,
): Array<{ name: string; content: string }> {
  const commands: Array<{ name: string; content: string }> = [];

  // Test command — for projects with tests
  if (profile.testCommands.length > 0) {
    const testCmd = best(profile.testCommands);
    commands.push({
      name: "test",
      content: [
        `Run the test suite and report results:`,
        `\`${testCmd}\` $ARGUMENTS`,
        ``,
        `If tests fail, analyze the failures and suggest fixes.`,
      ].join("\n"),
    });
  }

  // Dev command — for web projects with a dev server
  if (isWebProject(profile) && profile.devCommands.length > 0) {
    const devCmd = best(profile.devCommands);
    commands.push({
      name: "dev",
      content: [
        `Start the development server:`,
        `\`${devCmd}\``,
        ``,
        `$ARGUMENTS`,
      ].join("\n"),
    });
  }

  // Review command — always useful
  commands.push({
    name: "review",
    content: [
      `Review the recent changes for code quality, potential bugs, and adherence to project conventions:`,
      `$ARGUMENTS`,
      ``,
      `Focus on: correctness, security, performance, and readability.`,
    ].join("\n"),
  });

  return commands;
}
