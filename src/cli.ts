#!/usr/bin/env node

import { resolve, basename } from "node:path";
import { access, writeFile, mkdir, readFile } from "node:fs/promises";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { scanProject } from "./scanner/index.js";
import { generateConfig } from "./generator/index.js";
import type { GeneratedConfig, ProjectProfile } from "./scanner/types.js";

const VERSION = "1.0.0";

function formatLanguage(lang: string): string {
  const names: Record<string, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    python: "Python",
    rust: "Rust",
    go: "Go",
    java: "Java",
    ruby: "Ruby",
    csharp: "C#",
    swift: "Swift",
    unknown: "Unknown",
  };
  return names[lang] ?? lang;
}

function formatFramework(profile: ProjectProfile): string {
  if (profile.frameworks.length === 0) return "";
  return ` / ${profile.frameworks[0]!.name}`;
}

function countLines(text: string): number {
  return text.split("\n").length;
}

function printProfile(profile: ProjectProfile): void {
  console.log(chalk.bold("\nProject Profile:"));
  console.log(`  Name:            ${profile.name}`);
  console.log(
    `  Language:        ${formatLanguage(profile.language)} ${profile.languages.length > 1 ? `(+ ${profile.languages.slice(1).map(formatLanguage).join(", ")})` : ""}`,
  );
  if (profile.frameworks.length > 0) {
    console.log(
      `  Frameworks:      ${profile.frameworks.map((f) => f.name).join(", ")}`,
    );
  }
  if (profile.packageManager) {
    console.log(`  Package Manager: ${profile.packageManager}`);
  }
  if (profile.buildCommands.length > 0) {
    console.log(
      `  Build:           ${profile.buildCommands.map((c) => c.command).join(", ")}`,
    );
  }
  if (profile.testCommands.length > 0) {
    console.log(
      `  Test:            ${profile.testCommands.map((c) => c.command).join(", ")}`,
    );
  }
  if (profile.lintCommands.length > 0) {
    console.log(
      `  Lint:            ${profile.lintCommands.map((c) => c.command).join(", ")}`,
    );
  }
  if (profile.devCommands.length > 0) {
    console.log(
      `  Dev:             ${profile.devCommands.map((c) => c.command).join(", ")}`,
    );
  }
  console.log(`  Git:             ${profile.hasGit ? "yes" : "no"}`);
  console.log(`  Monorepo:        ${profile.isMonorepo ? "yes" : "no"}`);
  if (profile.directories.length > 0) {
    console.log(`  Directories:     ${profile.directories.join(", ")}`);
  }
  if (profile.configFiles.length > 0) {
    console.log(`  Config files:    ${profile.configFiles.join(", ")}`);
  }
  console.log();
}

function printDryRun(
  config: GeneratedConfig,
  dir: string,
  skipCommands: boolean,
): void {
  console.log(chalk.bold.yellow("\n--- DRY RUN (no files written) ---\n"));

  console.log(chalk.bold.underline("CLAUDE.md"));
  console.log(chalk.dim("─".repeat(60)));
  console.log(config.claudeMd);
  console.log(chalk.dim("─".repeat(60)));
  console.log();

  if (config.settings) {
    console.log(chalk.bold.underline(".claude/settings.local.json"));
    console.log(chalk.dim("─".repeat(60)));
    console.log(JSON.stringify(config.settings, null, 2));
    console.log(chalk.dim("─".repeat(60)));
    console.log();
  }

  if (!skipCommands && config.commands.length > 0) {
    for (const cmd of config.commands) {
      console.log(chalk.bold.underline(`.claude/commands/${cmd.name}.md`));
      console.log(chalk.dim("─".repeat(60)));
      console.log(cmd.content);
      console.log(chalk.dim("─".repeat(60)));
      console.log();
    }
  }

  console.log(chalk.yellow("No files were written. Remove --dry-run to generate.\n"));
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function writeConfig(
  config: GeneratedConfig,
  dir: string,
  force: boolean,
  skipCommands: boolean,
): Promise<string[]> {
  const written: string[] = [];

  // Write CLAUDE.md
  const claudeMdPath = resolve(dir, "CLAUDE.md");
  if ((await fileExists(claudeMdPath)) && !force) {
    console.log(
      chalk.yellow(
        "  ! CLAUDE.md already exists. Use --force to overwrite.",
      ),
    );
  } else {
    await writeFile(claudeMdPath, config.claudeMd, "utf-8");
    written.push(`CLAUDE.md (${countLines(config.claudeMd)} lines)`);
  }

  // Write settings.local.json
  if (config.settings) {
    const claudeDir = resolve(dir, ".claude");
    if (!(await fileExists(claudeDir))) {
      await mkdir(claudeDir, { recursive: true });
    }
    const settingsPath = resolve(claudeDir, "settings.local.json");

    // Count MCP servers for summary
    const settings = config.settings as Record<string, unknown>;
    const mcpServers = settings["mcpServers"] as
      | Record<string, unknown>
      | undefined;
    const serverCount = mcpServers ? Object.keys(mcpServers).length : 0;

    if ((await fileExists(settingsPath)) && !force) {
      console.log(
        chalk.yellow(
          "  ! .claude/settings.local.json already exists. Use --force to overwrite.",
        ),
      );
    } else {
      await writeFile(
        settingsPath,
        JSON.stringify(config.settings, null, 2) + "\n",
        "utf-8",
      );
      const label =
        serverCount > 0
          ? `${serverCount} MCP server${serverCount === 1 ? "" : "s"}`
          : "configured";
      written.push(`.claude/settings.local.json (${label})`);
    }
  }

  // Write slash commands
  if (!skipCommands && config.commands.length > 0) {
    const commandsDir = resolve(dir, ".claude", "commands");
    if (!(await fileExists(commandsDir))) {
      await mkdir(commandsDir, { recursive: true });
    }

    for (const cmd of config.commands) {
      const cmdPath = resolve(commandsDir, `${cmd.name}.md`);
      if ((await fileExists(cmdPath)) && !force) {
        console.log(
          chalk.yellow(
            `  ! .claude/commands/${cmd.name}.md already exists. Use --force to overwrite.`,
          ),
        );
      } else {
        await writeFile(cmdPath, cmd.content, "utf-8");
        written.push(`.claude/commands/${cmd.name}.md`);
      }
    }
  }

  return written;
}

async function run(): Promise<void> {
  const program = new Command();

  program
    .name("ccinit")
    .description("Auto-generate Claude Code configuration for your project.")
    .version(VERSION, "-V, --version")
    .argument("[directory]", "Project directory to scan", ".")
    .option("--dry-run", "Preview what would be generated without writing files")
    .option("--force", "Overwrite existing CLAUDE.md and settings")
    .option("--no-commands", "Skip generating slash commands")
    .option("--verbose", "Show detailed detection results")
    .action(async (directory: string, options: {
      dryRun?: boolean;
      force?: boolean;
      commands: boolean;
      verbose?: boolean;
    }) => {
      const dir = resolve(directory);

      // Check if directory exists
      if (!(await fileExists(dir))) {
        console.error(
          chalk.red(`Error: Directory "${dir}" does not exist.`),
        );
        process.exit(1);
      }

      // Scan project
      const scanSpinner = ora("Scanning project...").start();
      let profile: ProjectProfile;
      try {
        profile = await scanProject(dir);
        scanSpinner.succeed(
          `Scanned: ${chalk.bold(profile.name)} (${formatLanguage(profile.language)}${formatFramework(profile)})`,
        );
      } catch (err) {
        scanSpinner.fail("Failed to scan project");
        console.error(
          chalk.red(
            `Error: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // Show verbose profile
      if (options.verbose) {
        printProfile(profile);
      }

      // Generate config
      const genSpinner = ora("Generating configuration...").start();
      let config: GeneratedConfig;
      try {
        config = generateConfig(profile);
        genSpinner.succeed("Configuration generated");
      } catch (err) {
        genSpinner.fail("Failed to generate configuration");
        console.error(
          chalk.red(
            `Error: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // Dry run — print and exit
      if (options.dryRun) {
        printDryRun(config, dir, !options.commands);
        return;
      }

      // Write files
      const skipCommands = !options.commands;
      const written = await writeConfig(config, dir, !!options.force, skipCommands);

      // Print summary
      if (written.length > 0) {
        console.log(chalk.bold("\nGenerated:"));
        for (const file of written) {
          console.log(chalk.green(`  \u2713 ${file}`));
        }
        console.log(
          chalk.cyan(
            "\nRun `claude` to start coding with your new configuration!",
          ),
        );
      } else {
        console.log(
          chalk.yellow(
            "\nNo files were written. Use --force to overwrite existing files.",
          ),
        );
      }
    });

  await program.parseAsync(process.argv);
}

run().catch((err: unknown) => {
  console.error(
    chalk.red(`Fatal error: ${err instanceof Error ? err.message : String(err)}`),
  );
  process.exit(1);
});
