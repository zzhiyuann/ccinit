import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanProject } from "../src/scanner/index.js";
import { generateConfig } from "../src/generator/index.js";

describe("CLI integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ccinit-cli-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("scans a temp project and generates valid config", async () => {
    const pkg = {
      name: "cli-test-project",
      scripts: {
        build: "tsc",
        test: "vitest run",
        dev: "vite",
      },
      dependencies: {
        react: "^18.0.0",
      },
      devDependencies: {
        typescript: "^5.0.0",
      },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg));
    await writeFile(join(tempDir, "tsconfig.json"), "{}");

    const profile = await scanProject(tempDir);
    const config = generateConfig(profile);

    // CLAUDE.md should be generated with correct project name
    expect(config.claudeMd).toContain("# cli-test-project");
    expect(config.claudeMd).toContain("## Build & Run");
    expect(config.claudeMd).toContain("## Test");
    expect(config.claudeMd).toContain("## Tech Stack");
    expect(config.claudeMd).toContain("TypeScript");

    // Commands should include test and review
    const commandNames = config.commands.map((c) => c.name);
    expect(commandNames).toContain("test");
    expect(commandNames).toContain("review");
  });

  it("scans the ccinit project itself and detects TypeScript + npm", async () => {
    const projectRoot = process.cwd();
    const profile = await scanProject(projectRoot);

    expect(profile.name).toBe("ccinit");
    expect(profile.language).toBe("typescript");
    expect(profile.languages).toContain("typescript");
    expect(profile.packageManager).toBe("npm");

    // Should detect vitest config
    expect(profile.configFiles).toContain("vitest.config.ts");

    // Should detect package.json and tsconfig.json
    expect(profile.configFiles).toContain("package.json");
    expect(profile.configFiles).toContain("tsconfig.json");

    // Should have build and test commands from package.json scripts
    expect(profile.buildCommands.some((c) => c.command.includes("build"))).toBe(true);
    expect(profile.testCommands.some((c) => c.command.includes("test"))).toBe(true);

    // Should detect src directory
    expect(profile.directories).toContain("src");
    expect(profile.directories).toContain("tests");
  });
});
