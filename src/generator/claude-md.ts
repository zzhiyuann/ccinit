import type { ProjectProfile, DetectedCommand } from "../scanner/types.js";

/** Pick the highest-confidence command, or first if tied. */
function best(cmds: DetectedCommand[]): string | undefined {
  if (cmds.length === 0) return undefined;
  return cmds.reduce((a, b) => (b.confidence > a.confidence ? b : a)).command;
}

/** Format a command list as bullet points. */
function bulletList(cmds: DetectedCommand[]): string {
  // Deduplicate by command string, keep highest confidence
  const seen = new Map<string, DetectedCommand>();
  for (const cmd of cmds) {
    const existing = seen.get(cmd.command);
    if (!existing || cmd.confidence > existing.confidence) {
      seen.set(cmd.command, cmd);
    }
  }
  return Array.from(seen.values())
    .sort((a, b) => b.confidence - a.confidence)
    .map((c) => `- \`${c.command}\``)
    .join("\n");
}

/** Build the ## Build & Run section. */
function buildSection(profile: ProjectProfile): string | null {
  const parts: string[] = [];

  if (profile.buildCommands.length > 0) {
    parts.push(bulletList(profile.buildCommands));
  }
  if (profile.devCommands.length > 0) {
    parts.push("\nDev server:\n" + bulletList(profile.devCommands));
  }

  if (parts.length === 0) return null;
  return `## Build & Run\n${parts.join("\n").trim()}`;
}

/** Build the ## Test section. */
function testSection(profile: ProjectProfile): string | null {
  if (profile.testCommands.length === 0) return null;

  const primary = best(profile.testCommands);
  let section = `## Test\n${bulletList(profile.testCommands)}`;

  // Add a single-file example if the test runner supports it
  if (primary) {
    if (primary.includes("vitest") || primary.includes("jest")) {
      section += `\n- \`${primary} path/to/file.test.ts\` — run a single test file`;
    } else if (primary.includes("pytest")) {
      section += `\n- \`${primary} path/to/test_file.py\` — run a single test file`;
    } else if (primary.includes("cargo test")) {
      section += `\n- \`${primary} test_name\` — run a single test`;
    } else if (primary.includes("go test")) {
      section += `\n- \`${primary} ./pkg/...\` — run tests in a specific package`;
    }
  }

  return section;
}

/** Build the ## Lint & Format section. */
function lintSection(profile: ProjectProfile): string | null {
  if (profile.lintCommands.length === 0) return null;
  return `## Lint & Format\n${bulletList(profile.lintCommands)}`;
}

/** Build the ## Project Structure section. */
function structureSection(profile: ProjectProfile): string | null {
  if (profile.directories.length === 0) return null;

  const dirDescriptions: Record<string, string> = {
    src: "Source code",
    lib: "Library code",
    app: "Application entry / pages",
    pages: "Route pages",
    components: "UI components",
    hooks: "React hooks",
    utils: "Utility functions",
    helpers: "Helper functions",
    types: "Type definitions",
    models: "Data models",
    services: "Service layer",
    api: "API routes / handlers",
    routes: "Route definitions",
    controllers: "Request controllers",
    middleware: "Middleware",
    config: "Configuration",
    public: "Static assets",
    static: "Static files",
    assets: "Assets (images, fonts, etc.)",
    styles: "Stylesheets",
    tests: "Tests",
    test: "Tests",
    __tests__: "Tests",
    spec: "Test specs",
    scripts: "Build / utility scripts",
    docs: "Documentation",
    migrations: "Database migrations",
    prisma: "Prisma schema & migrations",
    cmd: "CLI entry points (Go)",
    pkg: "Library packages (Go)",
    internal: "Internal packages (Go)",
    crates: "Workspace crates (Rust)",
    benches: "Benchmarks",
  };

  const lines = profile.directories
    .map((dir) => {
      const base = dir.split("/").pop() ?? dir;
      const desc = dirDescriptions[base];
      return desc ? `- \`${dir}/\` — ${desc}` : `- \`${dir}/\``;
    })
    .join("\n");

  return `## Project Structure\n${lines}`;
}

/** Build the ## Tech Stack section. */
function techStackSection(profile: ProjectProfile): string | null {
  const parts: string[] = [];

  // Language
  const langNames: Record<string, string> = {
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
  parts.push(`- Language: ${langNames[profile.language] ?? profile.language}`);

  // Frameworks
  if (profile.frameworks.length > 0) {
    const fws = profile.frameworks.map((f) => f.name).join(", ");
    parts.push(`- Framework: ${fws}`);
  }

  // Package manager
  if (profile.packageManager) {
    parts.push(`- Package manager: ${profile.packageManager}`);
  }

  return `## Tech Stack\n${parts.join("\n")}`;
}

/** Build the ## Conventions section based on config files and language. */
function conventionsSection(profile: ProjectProfile): string | null {
  const conventions: string[] = [];

  // TypeScript conventions
  if (profile.language === "typescript") {
    if (profile.configFiles.includes("tsconfig.json")) {
      conventions.push("- TypeScript strict mode enabled");
    }
    // ESM detection
    conventions.push("- ESM modules (`import`/`export`)");
  }

  // Python conventions
  if (profile.language === "python") {
    const hasRuff = profile.configFiles.some(
      (f) => f === "ruff.toml" || f === ".ruff.toml",
    ) || profile.lintCommands.some((c) => c.command.includes("ruff"));
    if (hasRuff) {
      conventions.push("- Use `ruff` for formatting and linting");
    }

    const hasBlack = profile.lintCommands.some((c) => c.command.includes("black"));
    if (hasBlack && !hasRuff) {
      conventions.push("- Use `black` for formatting");
    }

    const hasMypy = profile.configFiles.some(
      (f) => f === "mypy.ini" || f === ".mypy.ini",
    ) || profile.lintCommands.some((c) => c.command.includes("mypy"));
    if (hasMypy) {
      conventions.push("- Type hints expected (mypy / pyright)");
    }
  }

  // Rust conventions
  if (profile.language === "rust") {
    if (profile.configFiles.includes("Cargo.toml")) {
      conventions.push("- Follow `cargo fmt` formatting");
      conventions.push("- Address all `cargo clippy` warnings");
    }
  }

  // Go conventions
  if (profile.language === "go") {
    if (profile.configFiles.includes("go.mod")) {
      conventions.push("- Follow `gofmt` / `goimports` formatting");
      conventions.push("- Exported names must be documented");
    }
  }

  // ESLint / Prettier
  const hasEslint = profile.configFiles.some(
    (f) => f.includes("eslint"),
  );
  const hasPrettier = profile.configFiles.some(
    (f) => f.includes("prettier"),
  );
  if (hasEslint) conventions.push("- ESLint configured — fix all warnings");
  if (hasPrettier) conventions.push("- Prettier configured — format before committing");

  if (conventions.length === 0) return null;
  return `## Conventions\n${conventions.join("\n")}`;
}

/**
 * Generate CLAUDE.md content from a ProjectProfile.
 * Pure function — no file I/O.
 */
export function generateClaudeMd(profile: ProjectProfile): string {
  const sections: string[] = [];

  // Title
  sections.push(`# ${profile.name}`);

  // Build & Run
  const build = buildSection(profile);
  if (build) sections.push(build);

  // Test
  const test = testSection(profile);
  if (test) sections.push(test);

  // Lint & Format
  const lint = lintSection(profile);
  if (lint) sections.push(lint);

  // Project Structure
  const structure = structureSection(profile);
  if (structure) sections.push(structure);

  // Tech Stack
  const stack = techStackSection(profile);
  if (stack) sections.push(stack);

  // Conventions
  const conv = conventionsSection(profile);
  if (conv) sections.push(conv);

  return sections.join("\n\n") + "\n";
}
