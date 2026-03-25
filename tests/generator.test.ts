import type { ProjectProfile } from "../src/scanner/types.js";
import {
  generateConfig,
  generateClaudeMd,
  generateSettings,
  generateCommands,
} from "../src/generator/index.js";

function makeProfile(overrides: Partial<ProjectProfile> = {}): ProjectProfile {
  return {
    name: "test-project",
    language: "typescript",
    languages: ["typescript"],
    frameworks: [],
    packageManager: "npm",
    buildCommands: [],
    testCommands: [],
    lintCommands: [],
    devCommands: [],
    directories: [],
    configFiles: [],
    hasGit: false,
    hasClaudeMd: false,
    isMonorepo: false,
    entryPoints: [],
    ...overrides,
  };
}

describe("generateClaudeMd", () => {
  it("generates full CLAUDE.md for a TypeScript project with commands", () => {
    const profile = makeProfile({
      name: "my-web-app",
      language: "typescript",
      languages: ["typescript"],
      frameworks: [{ name: "React", category: "web" }],
      packageManager: "npm",
      buildCommands: [
        { command: "npm run build", source: "package.json scripts.build", confidence: 0.9 },
      ],
      testCommands: [
        { command: "npm run test", source: "package.json scripts.test", confidence: 0.9 },
      ],
      lintCommands: [
        { command: "npm run lint", source: "package.json scripts.lint", confidence: 0.9 },
      ],
      devCommands: [
        { command: "npm run dev", source: "package.json scripts.dev", confidence: 0.9 },
      ],
      configFiles: ["tsconfig.json"],
    });

    const md = generateClaudeMd(profile);

    expect(md).toContain("# my-web-app");
    expect(md).toContain("## Build & Run");
    expect(md).toContain("`npm run build`");
    expect(md).toContain("Dev server:");
    expect(md).toContain("`npm run dev`");
    expect(md).toContain("## Test");
    expect(md).toContain("`npm run test`");
    expect(md).toContain("## Lint & Format");
    expect(md).toContain("`npm run lint`");
    expect(md).toContain("## Tech Stack");
    expect(md).toContain("TypeScript");
    expect(md).toContain("React");
    expect(md).toContain("## Conventions");
    expect(md).toContain("TypeScript strict mode");
  });

  it("generates minimal CLAUDE.md for an unknown project", () => {
    const profile = makeProfile({
      name: "empty-project",
      language: "unknown",
      languages: ["unknown"],
      packageManager: null,
    });

    const md = generateClaudeMd(profile);

    expect(md).toContain("# empty-project");
    expect(md).toContain("## Tech Stack");
    expect(md).toContain("Unknown");
    expect(md).not.toContain("## Build & Run");
    expect(md).not.toContain("## Test");
    expect(md).not.toContain("## Lint & Format");
  });

  it("includes project structure when directories are present", () => {
    const profile = makeProfile({
      directories: ["src", "tests", "docs"],
    });

    const md = generateClaudeMd(profile);

    expect(md).toContain("## Project Structure");
    expect(md).toContain("`src/`");
    expect(md).toContain("`tests/`");
    expect(md).toContain("`docs/`");
  });

  it("adds single-test-file example for vitest", () => {
    const profile = makeProfile({
      testCommands: [
        { command: "npm run test", source: "package.json scripts.test", confidence: 0.9 },
      ],
    });

    // The best command doesn't include "vitest" in the command text, so
    // let's use a raw vitest command
    const profile2 = makeProfile({
      testCommands: [
        { command: "vitest run", source: "vitest.config.ts", confidence: 0.9 },
      ],
    });

    const md = generateClaudeMd(profile2);
    expect(md).toContain("run a single test file");
  });

  it("adds single-test-file example for pytest", () => {
    const profile = makeProfile({
      language: "python",
      languages: ["python"],
      testCommands: [
        { command: "pytest", source: "detected pytest dependency", confidence: 0.9 },
      ],
    });

    const md = generateClaudeMd(profile);
    expect(md).toContain("run a single test file");
    expect(md).toContain("test_file.py");
  });

  it("includes conventions for Rust projects", () => {
    const profile = makeProfile({
      language: "rust",
      languages: ["rust"],
      configFiles: ["Cargo.toml"],
    });

    const md = generateClaudeMd(profile);

    expect(md).toContain("## Conventions");
    expect(md).toContain("cargo fmt");
    expect(md).toContain("cargo clippy");
  });

  it("includes conventions for Go projects", () => {
    const profile = makeProfile({
      language: "go",
      languages: ["go"],
      configFiles: ["go.mod"],
    });

    const md = generateClaudeMd(profile);

    expect(md).toContain("## Conventions");
    expect(md).toContain("gofmt");
    expect(md).toContain("Exported names must be documented");
  });

  it("includes ESLint and Prettier conventions when detected", () => {
    const profile = makeProfile({
      configFiles: ["eslint.config.js", ".prettierrc"],
    });

    const md = generateClaudeMd(profile);

    expect(md).toContain("ESLint configured");
    expect(md).toContain("Prettier configured");
  });
});

describe("generateSettings", () => {
  it("returns MCP git config when hasGit is true", () => {
    const profile = makeProfile({ hasGit: true });
    const settings = generateSettings(profile);

    expect(settings).not.toBeNull();
    expect(settings).toHaveProperty("mcpServers");
    const servers = (settings as Record<string, unknown>)["mcpServers"] as Record<string, unknown>;
    expect(servers).toHaveProperty("git");
    const git = servers["git"] as Record<string, unknown>;
    expect(git["command"]).toBe("npx");
    expect(git["args"]).toEqual(["-y", "@anthropic/mcp-git"]);
  });

  it("returns filesystem and context7 even when hasGit is false", () => {
    const profile = makeProfile({ hasGit: false });
    const settings = generateSettings(profile);

    expect(settings).not.toBeNull();
    const servers = (settings as Record<string, unknown>)["mcpServers"] as Record<string, unknown>;
    expect(servers).toHaveProperty("filesystem");
    expect(servers).toHaveProperty("context7");
    expect(servers).not.toHaveProperty("git");
  });

  it("recommends puppeteer for web frontend projects", () => {
    const profile = makeProfile({
      frameworks: [{ name: "React", category: "web" }],
    });
    const settings = generateSettings(profile);

    expect(settings).not.toBeNull();
    const servers = (settings as Record<string, unknown>)["mcpServers"] as Record<string, unknown>;
    expect(servers).toHaveProperty("puppeteer");
  });

  it("recommends postgres for projects with database signals", () => {
    const profile = makeProfile({
      directories: ["migrations", "src"],
    });
    const settings = generateSettings(profile);

    expect(settings).not.toBeNull();
    const servers = (settings as Record<string, unknown>)["mcpServers"] as Record<string, unknown>;
    expect(servers).toHaveProperty("postgres");
  });
});

describe("generateCommands", () => {
  it("generates test, dev, and review commands for a web project with tests", () => {
    const profile = makeProfile({
      frameworks: [{ name: "React", category: "web" }],
      testCommands: [
        { command: "npm run test", source: "package.json scripts.test", confidence: 0.9 },
      ],
      devCommands: [
        { command: "npm run dev", source: "package.json scripts.dev", confidence: 0.9 },
      ],
    });

    const commands = generateCommands(profile);
    const names = commands.map((c) => c.name);

    expect(names).toContain("test");
    expect(names).toContain("dev");
    expect(names).toContain("review");

    const testCmd = commands.find((c) => c.name === "test");
    expect(testCmd?.content).toContain("npm run test");
    expect(testCmd?.content).toContain("$ARGUMENTS");

    const devCmd = commands.find((c) => c.name === "dev");
    expect(devCmd?.content).toContain("npm run dev");
  });

  it("generates test and review but NOT dev for a CLI project", () => {
    const profile = makeProfile({
      frameworks: [{ name: "Clap", category: "cli" }],
      testCommands: [
        { command: "cargo test", source: "Cargo.toml", confidence: 0.95 },
      ],
      devCommands: [
        { command: "cargo run", source: "Cargo.toml", confidence: 0.9 },
      ],
    });

    const commands = generateCommands(profile);
    const names = commands.map((c) => c.name);

    expect(names).toContain("test");
    expect(names).toContain("review");
    expect(names).not.toContain("dev");
  });

  it("generates only review for a project with no tests", () => {
    const profile = makeProfile({
      testCommands: [],
      devCommands: [],
    });

    const commands = generateCommands(profile);
    const names = commands.map((c) => c.name);

    expect(names).toEqual(["review"]);
  });

  it("review command includes quality focus areas", () => {
    const profile = makeProfile();
    const commands = generateCommands(profile);
    const review = commands.find((c) => c.name === "review");

    expect(review?.content).toContain("correctness");
    expect(review?.content).toContain("security");
    expect(review?.content).toContain("performance");
    expect(review?.content).toContain("readability");
  });

  it("generates component command for React projects", () => {
    const profile = makeProfile({
      frameworks: [{ name: "React", category: "web" }],
    });
    const commands = generateCommands(profile);
    const names = commands.map((c) => c.name);

    expect(names).toContain("component");
    const cmd = commands.find((c) => c.name === "component");
    expect(cmd?.content).toContain("props");
    expect(cmd?.content).toContain("accessibility");
  });

  it("generates build-prod command for Next.js projects", () => {
    const profile = makeProfile({
      frameworks: [
        { name: "Next.js", category: "web" },
        { name: "React", category: "web" },
      ],
    });
    const commands = generateCommands(profile);
    const names = commands.map((c) => c.name);

    expect(names).toContain("build-prod");
    expect(names).toContain("component");
  });

  it("generates migrate command for Django projects", () => {
    const profile = makeProfile({
      language: "python",
      frameworks: [{ name: "Django", category: "web" }],
    });
    const commands = generateCommands(profile);
    const names = commands.map((c) => c.name);

    expect(names).toContain("migrate");
    const cmd = commands.find((c) => c.name === "migrate");
    expect(cmd?.content).toContain("manage.py");
  });

  it("generates routes command for FastAPI projects", () => {
    const profile = makeProfile({
      language: "python",
      frameworks: [{ name: "FastAPI", category: "api" }],
    });
    const commands = generateCommands(profile);
    const names = commands.map((c) => c.name);

    expect(names).toContain("routes");
  });

  it("generates check command for Rust projects", () => {
    const profile = makeProfile({
      language: "rust",
      frameworks: [],
    });
    const commands = generateCommands(profile);
    const names = commands.map((c) => c.name);

    expect(names).toContain("check");
    const cmd = commands.find((c) => c.name === "check");
    expect(cmd?.content).toContain("cargo clippy");
  });

  it("generates schema command for projects with migrations", () => {
    const profile = makeProfile({
      directories: ["src", "migrations"],
    });
    const commands = generateCommands(profile);
    const names = commands.map((c) => c.name);

    expect(names).toContain("schema");
  });
});

describe("generateConfig", () => {
  it("returns an object with claudeMd, settings, and commands", () => {
    const profile = makeProfile({
      name: "combined-test",
      hasGit: true,
      testCommands: [
        { command: "npm run test", source: "package.json scripts.test", confidence: 0.9 },
      ],
    });

    const config = generateConfig(profile);

    expect(config).toHaveProperty("claudeMd");
    expect(config).toHaveProperty("settings");
    expect(config).toHaveProperty("commands");

    expect(typeof config.claudeMd).toBe("string");
    expect(config.claudeMd).toContain("# combined-test");

    expect(config.settings).not.toBeNull();
    expect((config.settings as Record<string, unknown>)["mcpServers"]).toBeDefined();

    expect(Array.isArray(config.commands)).toBe(true);
    expect(config.commands.length).toBeGreaterThan(0);
  });

  it("returns settings with filesystem and context7 even without git", () => {
    const profile = makeProfile({ hasGit: false });
    const config = generateConfig(profile);

    expect(config.settings).not.toBeNull();
    const servers = (config.settings as Record<string, unknown>)["mcpServers"] as Record<string, unknown>;
    expect(servers).toHaveProperty("filesystem");
    expect(servers).toHaveProperty("context7");
    expect(servers).not.toHaveProperty("git");
  });
});
