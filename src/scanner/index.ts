import { access, readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import type { ProjectProfile } from "./types.js";
import { detectLanguages } from "./detect-language.js";
import { detectFrameworks } from "./detect-framework.js";
import { detectCommands } from "./detect-commands.js";

export { detectLanguages } from "./detect-language.js";
export { detectFrameworks } from "./detect-framework.js";
export { detectCommands } from "./detect-commands.js";
export type { LanguageResult } from "./detect-language.js";

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function safeReadFile(filepath: string): Promise<string | null> {
  try {
    return await readFile(filepath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Sanitize a project name to prevent markdown/prompt injection.
 * Strips control characters (newlines, tabs, etc.) and trims whitespace.
 * JSON.parse interprets \n as real newlines in package.json name fields,
 * which could inject arbitrary markdown into generated CLAUDE.md (a system prompt).
 */
function sanitizeProjectName(name: string): string {
  // Strip all control characters (U+0000–U+001F, U+007F, U+0080–U+009F)
  // and trim surrounding whitespace
  return name.replace(/[\x00-\x1f\x7f-\x9f]/g, "").trim();
}

/**
 * Detect the project name from config files, falling back to directory name.
 */
async function detectProjectName(dir: string): Promise<string> {
  // Try package.json
  const pkgContent = await safeReadFile(join(dir, "package.json"));
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
      if (typeof pkg["name"] === "string" && pkg["name"]) {
        const sanitized = sanitizeProjectName(pkg["name"]);
        return sanitized || basename(dir);
      }
    } catch {
      // Invalid JSON
    }
  }

  // Try Cargo.toml
  const cargoContent = await safeReadFile(join(dir, "Cargo.toml"));
  if (cargoContent) {
    const match = /^\s*name\s*=\s*"([^"]+)"/m.exec(cargoContent);
    if (match?.[1]) return match[1];
  }

  // Try pyproject.toml
  const pyContent = await safeReadFile(join(dir, "pyproject.toml"));
  if (pyContent) {
    const match = /^\s*name\s*=\s*"([^"]+)"/m.exec(pyContent);
    if (match?.[1]) return match[1];
  }

  // Try go.mod
  const goContent = await safeReadFile(join(dir, "go.mod"));
  if (goContent) {
    const match = /^module\s+(\S+)/m.exec(goContent);
    if (match?.[1]) {
      // Use last path segment: github.com/foo/bar -> bar
      const parts = match[1].split("/");
      return parts[parts.length - 1] ?? match[1];
    }
  }

  // Fallback: directory name
  return basename(dir);
}

/**
 * Detect the package manager for Node.js projects.
 */
async function detectPackageManager(dir: string): Promise<string | null> {
  // Lock files indicate the package manager
  if (await fileExists(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (await fileExists(join(dir, "yarn.lock"))) return "yarn";
  if (await fileExists(join(dir, "bun.lockb"))) return "bun";
  if (await fileExists(join(dir, "package-lock.json"))) return "npm";

  // Python
  if (await fileExists(join(dir, "Pipfile.lock"))) return "pipenv";
  if (await fileExists(join(dir, "poetry.lock"))) return "poetry";
  if (await fileExists(join(dir, "uv.lock"))) return "uv";
  if (
    (await fileExists(join(dir, "pyproject.toml"))) ||
    (await fileExists(join(dir, "requirements.txt")))
  )
    return "pip";

  // Rust
  if (await fileExists(join(dir, "Cargo.lock"))) return "cargo";

  // Go
  if (await fileExists(join(dir, "go.sum"))) return "go";

  // Ruby
  if (await fileExists(join(dir, "Gemfile.lock"))) return "bundler";

  // Java
  if (await fileExists(join(dir, "pom.xml"))) return "maven";
  if (
    (await fileExists(join(dir, "build.gradle"))) ||
    (await fileExists(join(dir, "build.gradle.kts")))
  )
    return "gradle";

  // If package.json exists but no lock file, assume npm
  if (await fileExists(join(dir, "package.json"))) return "npm";

  return null;
}

/**
 * Detect if the project is a monorepo.
 */
async function detectMonorepo(dir: string): Promise<boolean> {
  // pnpm workspace
  if (await fileExists(join(dir, "pnpm-workspace.yaml"))) return true;

  // Lerna
  if (await fileExists(join(dir, "lerna.json"))) return true;

  // npm/yarn workspaces in package.json
  const pkgContent = await safeReadFile(join(dir, "package.json"));
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
      if (pkg["workspaces"]) return true;
    } catch {
      // Invalid JSON
    }
  }

  // Cargo workspace
  const cargoContent = await safeReadFile(join(dir, "Cargo.toml"));
  if (cargoContent && cargoContent.includes("[workspace]")) return true;

  // Python uv workspace
  const pyprojectContent = await safeReadFile(join(dir, "pyproject.toml"));
  if (pyprojectContent && pyprojectContent.includes("[tool.uv.workspace]")) return true;

  return false;
}

/**
 * Find key directories that exist in the project.
 */
async function detectDirectories(dir: string): Promise<string[]> {
  const candidates = [
    "src",
    "lib",
    "app",
    "pages",
    "components",
    "public",
    "static",
    "assets",
    "test",
    "tests",
    "__tests__",
    "spec",
    "docs",
    "doc",
    ".github",
    ".claude",
    ".vscode",
    "scripts",
    "bin",
    "cmd",
    "internal",
    "pkg",
    "packages",
    "apps",
    "crates",
    "e2e",
    "cypress",
    "playwright",
  ];

  const found: string[] = [];
  for (const candidate of candidates) {
    if (await fileExists(join(dir, candidate))) {
      found.push(candidate);
    }
  }
  return found;
}

/**
 * Find key config files that exist in the project root.
 */
async function detectConfigFiles(dir: string): Promise<string[]> {
  const candidates = [
    "package.json",
    "tsconfig.json",
    "tsconfig.build.json",
    "Cargo.toml",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "requirements.txt",
    "Pipfile",
    "go.mod",
    "Gemfile",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "Package.swift",
    "Makefile",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".dockerignore",
    ".env.example",
    ".eslintrc.json",
    ".eslintrc.js",
    ".eslintrc.cjs",
    "eslint.config.js",
    "eslint.config.mjs",
    ".prettierrc",
    ".prettierrc.json",
    "prettier.config.js",
    "biome.json",
    "biome.jsonc",
    "vitest.config.ts",
    "vitest.config.js",
    "jest.config.ts",
    "jest.config.js",
    "jest.config.cjs",
    ".github/workflows",
    "CLAUDE.md",
    ".claude/settings.local.json",
    ".editorconfig",
    "tailwind.config.ts",
    "tailwind.config.js",
    "postcss.config.js",
    "vite.config.ts",
    "vite.config.js",
    "webpack.config.js",
    "rollup.config.js",
    "turbo.json",
    "nx.json",
  ];

  const found: string[] = [];
  for (const candidate of candidates) {
    if (await fileExists(join(dir, candidate))) {
      found.push(candidate);
    }
  }
  return found;
}

/**
 * Find common entry point files.
 */
async function detectEntryPoints(dir: string): Promise<string[]> {
  const candidates = [
    "src/index.ts",
    "src/index.js",
    "src/main.ts",
    "src/main.js",
    "src/app.ts",
    "src/app.js",
    "src/server.ts",
    "src/server.js",
    "src/cli.ts",
    "src/cli.js",
    "index.ts",
    "index.js",
    "main.ts",
    "main.js",
    "app.ts",
    "app.js",
    "main.py",
    "app.py",
    "manage.py",
    "__main__.py",
    "src/main.rs",
    "src/lib.rs",
    "main.go",
    "cmd/main.go",
  ];

  const found: string[] = [];
  for (const candidate of candidates) {
    if (await fileExists(join(dir, candidate))) {
      found.push(candidate);
    }
  }

  // Also check package.json main/bin entries
  const pkgContent = await safeReadFile(join(dir, "package.json"));
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
      if (typeof pkg["main"] === "string" && pkg["main"]) {
        // Check source variant (e.g., dist/cli.js -> src/cli.ts)
        const mainFile = pkg["main"] as string;
        const srcVariant = mainFile
          .replace(/^\.\//, "")
          .replace(/^dist\//, "src/")
          .replace(/\.js$/, ".ts");
        if (!found.includes(srcVariant) && (await fileExists(join(dir, srcVariant)))) {
          found.push(srcVariant);
        }
      }
      if (typeof pkg["bin"] === "object" && pkg["bin"]) {
        const binEntries = pkg["bin"] as Record<string, string>;
        for (const binPath of Object.values(binEntries)) {
          const srcVariant = binPath
            .replace(/^\.\//, "")
            .replace(/^dist\//, "src/")
            .replace(/\.js$/, ".ts");
          if (!found.includes(srcVariant) && (await fileExists(join(dir, srcVariant)))) {
            found.push(srcVariant);
          }
        }
      }
    } catch {
      // Invalid JSON
    }
  }

  return found;
}

/**
 * Scan a project directory and build a complete ProjectProfile.
 */
export async function scanProject(dir: string): Promise<ProjectProfile> {
  // Run independent detections in parallel
  const [
    name,
    languageResult,
    packageManager,
    isMonorepo,
    directories,
    configFiles,
    entryPoints,
    hasGit,
    hasClaudeMd,
  ] = await Promise.all([
    detectProjectName(dir),
    detectLanguages(dir),
    detectPackageManager(dir),
    detectMonorepo(dir),
    detectDirectories(dir),
    detectConfigFiles(dir),
    detectEntryPoints(dir),
    fileExists(join(dir, ".git")),
    fileExists(join(dir, "CLAUDE.md")),
  ]);

  // Subdirectory fallback: if root detection found no language, try common subdirectories
  const FALLBACK_SUBDIRS = ["server", "backend", "app", "web", "frontend", "src"];
  let effectiveDir = dir;
  let effectiveLanguageResult = languageResult;
  let effectivePackageManager = packageManager;

  if (languageResult.primary === "unknown") {
    for (const subdir of FALLBACK_SUBDIRS) {
      const subdirPath = join(dir, subdir);
      if (!(await fileExists(subdirPath))) continue;

      const subLanguageResult = await detectLanguages(subdirPath);
      if (subLanguageResult.primary !== "unknown") {
        effectiveDir = subdirPath;
        effectiveLanguageResult = subLanguageResult;
        // Re-detect package manager for the subdirectory
        effectivePackageManager = await detectPackageManager(subdirPath);
        break;
      }
    }
  }

  // These depend on language detection results
  const [frameworks, commands] = await Promise.all([
    detectFrameworks(effectiveDir, effectiveLanguageResult.all),
    detectCommands(effectiveDir, effectiveLanguageResult.all, effectivePackageManager),
  ]);

  // If commands came from a subdirectory, prefix them with `cd <subdir> &&`
  const prefixCommand = (cmd: { command: string; source: string; confidence: number }) => {
    if (effectiveDir !== dir) {
      const subdir = effectiveDir.slice(dir.length + 1); // strip leading dir + "/"
      return { ...cmd, command: `cd ${subdir} && ${cmd.command}` };
    }
    return cmd;
  };

  return {
    name,
    language: effectiveLanguageResult.primary,
    languages: effectiveLanguageResult.all,
    frameworks,
    packageManager: effectivePackageManager,
    buildCommands: commands.build.map(prefixCommand),
    testCommands: commands.test.map(prefixCommand),
    lintCommands: commands.lint.map(prefixCommand),
    devCommands: commands.dev.map(prefixCommand),
    directories,
    configFiles,
    hasGit,
    hasClaudeMd,
    isMonorepo,
    entryPoints,
  };
}
