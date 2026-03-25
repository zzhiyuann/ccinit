import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DetectedCommand, Language } from "./types.js";

interface CommandResult {
  build: DetectedCommand[];
  test: DetectedCommand[];
  lint: DetectedCommand[];
  dev: DetectedCommand[];
}

async function safeReadFile(filepath: string): Promise<string | null> {
  try {
    return await readFile(filepath, "utf-8");
  } catch {
    return null;
  }
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath);
    return true;
  } catch {
    return false;
  }
}

// -- Node/TypeScript/JavaScript --

function detectNodeCommands(
  pkgContent: string,
  packageManager: string,
): CommandResult {
  const result: CommandResult = { build: [], test: [], lint: [], dev: [] };
  const run = packageManager === "yarn" ? "yarn" : `${packageManager} run`;

  try {
    const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
    const scripts = (pkg["scripts"] ?? {}) as Record<string, string>;

    // Build commands
    for (const key of ["build", "compile"]) {
      if (scripts[key]) {
        result.build.push({
          command: `${run} ${key}`,
          source: `package.json scripts.${key}`,
          confidence: 0.9,
        });
      }
    }

    // Test commands
    for (const key of ["test", "test:unit", "test:e2e", "test:integration"]) {
      if (scripts[key]) {
        result.test.push({
          command: `${run} ${key}`,
          source: `package.json scripts.${key}`,
          confidence: key === "test" ? 0.9 : 0.8,
        });
      }
    }

    // Lint commands
    for (const key of ["lint", "format", "lint:fix"]) {
      if (scripts[key]) {
        result.lint.push({
          command: `${run} ${key}`,
          source: `package.json scripts.${key}`,
          confidence: 0.9,
        });
      }
    }

    // Dev commands
    for (const key of ["dev", "start", "serve"]) {
      if (scripts[key]) {
        result.dev.push({
          command: `${run} ${key}`,
          source: `package.json scripts.${key}`,
          confidence: key === "dev" ? 0.9 : 0.8,
        });
      }
    }
  } catch {
    // Invalid JSON — skip
  }

  return result;
}

// -- Python --

async function detectPythonCommands(dir: string): Promise<CommandResult> {
  const result: CommandResult = { build: [], test: [], lint: [], dev: [] };

  const pyproject = await safeReadFile(join(dir, "pyproject.toml"));
  const requirements = await safeReadFile(join(dir, "requirements.txt"));
  const combined = [pyproject, requirements].filter(Boolean).join("\n");
  const lower = combined.toLowerCase();

  // Build
  if (pyproject?.includes("[build-system]")) {
    if (pyproject.includes("poetry")) {
      result.build.push({
        command: "poetry build",
        source: "pyproject.toml (poetry)",
        confidence: 0.9,
      });
    } else {
      result.build.push({
        command: "pip install -e .",
        source: "pyproject.toml",
        confidence: 0.8,
      });
    }
  } else if (await fileExists(join(dir, "setup.py"))) {
    result.build.push({
      command: "python setup.py build",
      source: "setup.py",
      confidence: 0.7,
    });
  }

  // Test
  if (lower.includes("pytest")) {
    result.test.push({
      command: "pytest",
      source: "detected pytest dependency",
      confidence: 0.9,
    });
  } else {
    result.test.push({
      command: "python -m unittest",
      source: "Python default",
      confidence: 0.5,
    });
  }

  // Lint
  const lintTools: Array<{ dep: string; command: string }> = [
    { dep: "ruff", command: "ruff check ." },
    { dep: "black", command: "black --check ." },
    { dep: "flake8", command: "flake8" },
    { dep: "mypy", command: "mypy ." },
    { dep: "pylint", command: "pylint" },
  ];
  for (const tool of lintTools) {
    if (lower.includes(tool.dep)) {
      result.lint.push({
        command: tool.command,
        source: `detected ${tool.dep} dependency`,
        confidence: 0.8,
      });
    }
  }

  // Dev
  if (lower.includes("uvicorn")) {
    result.dev.push({
      command: "uvicorn main:app --reload",
      source: "detected uvicorn dependency",
      confidence: 0.7,
    });
  }
  if (lower.includes("flask")) {
    result.dev.push({
      command: "flask run",
      source: "detected flask dependency",
      confidence: 0.7,
    });
  }
  if (await fileExists(join(dir, "manage.py"))) {
    result.dev.push({
      command: "python manage.py runserver",
      source: "manage.py (Django)",
      confidence: 0.9,
    });
  }

  return result;
}

// -- Rust --

function detectRustCommands(): CommandResult {
  return {
    build: [
      { command: "cargo build", source: "Cargo.toml", confidence: 0.95 },
    ],
    test: [
      { command: "cargo test", source: "Cargo.toml", confidence: 0.95 },
    ],
    lint: [
      { command: "cargo clippy", source: "Cargo.toml", confidence: 0.9 },
      {
        command: "cargo fmt --check",
        source: "Cargo.toml",
        confidence: 0.9,
      },
    ],
    dev: [{ command: "cargo run", source: "Cargo.toml", confidence: 0.9 }],
  };
}

// -- Go --

async function detectGoCommands(dir: string): Promise<CommandResult> {
  const result: CommandResult = {
    build: [
      { command: "go build ./...", source: "go.mod", confidence: 0.95 },
    ],
    test: [
      { command: "go test ./...", source: "go.mod", confidence: 0.95 },
    ],
    lint: [],
    dev: [{ command: "go run .", source: "go.mod", confidence: 0.9 }],
  };

  // Check for golangci-lint config
  const lintConfigs = [
    ".golangci.yml",
    ".golangci.yaml",
    ".golangci.toml",
    ".golangci.json",
  ];
  for (const config of lintConfigs) {
    if (await fileExists(join(dir, config))) {
      result.lint.push({
        command: "golangci-lint run",
        source: config,
        confidence: 0.9,
      });
      break;
    }
  }

  if (result.lint.length === 0) {
    result.lint.push({
      command: "golangci-lint run",
      source: "go.mod (inferred)",
      confidence: 0.5,
    });
  }

  return result;
}

// -- Makefile --

async function detectMakefileCommands(
  dir: string,
): Promise<Partial<CommandResult>> {
  const content = await safeReadFile(join(dir, "Makefile"));
  if (!content) return {};

  const result: Partial<CommandResult> = {};

  // Parse Makefile targets: lines that match `target:` at the start
  const targetMap: Record<string, string[]> = {
    build: ["build"],
    test: ["test"],
    lint: ["lint"],
    dev: ["dev", "run", "start", "serve"],
  };

  const targets = new Set<string>();
  for (const line of content.split("\n")) {
    const match = /^([a-zA-Z_][\w-]*):\s*/.exec(line);
    if (match?.[1]) {
      targets.add(match[1]);
    }
  }

  for (const [category, names] of Object.entries(targetMap)) {
    for (const name of names) {
      if (targets.has(name)) {
        const key = category as keyof CommandResult;
        if (!result[key]) result[key] = [];
        result[key]!.push({
          command: `make ${name}`,
          source: `Makefile target: ${name}`,
          confidence: 0.85,
        });
      }
    }
  }

  return result;
}

// -- Main --

export async function detectCommands(
  dir: string,
  languages: Language[],
  packageManager: string | null,
): Promise<CommandResult> {
  const result: CommandResult = { build: [], test: [], lint: [], dev: [] };

  // Language-specific detection
  if (languages.includes("typescript") || languages.includes("javascript")) {
    const pkgContent = await safeReadFile(join(dir, "package.json"));
    if (pkgContent) {
      const nodeResult = detectNodeCommands(
        pkgContent,
        packageManager ?? "npm",
      );
      result.build.push(...nodeResult.build);
      result.test.push(...nodeResult.test);
      result.lint.push(...nodeResult.lint);
      result.dev.push(...nodeResult.dev);
    }
  }

  if (languages.includes("python")) {
    const pyResult = await detectPythonCommands(dir);
    result.build.push(...pyResult.build);
    result.test.push(...pyResult.test);
    result.lint.push(...pyResult.lint);
    result.dev.push(...pyResult.dev);
  }

  if (languages.includes("rust")) {
    const rustResult = detectRustCommands();
    result.build.push(...rustResult.build);
    result.test.push(...rustResult.test);
    result.lint.push(...rustResult.lint);
    result.dev.push(...rustResult.dev);
  }

  if (languages.includes("go")) {
    const goResult = await detectGoCommands(dir);
    result.build.push(...goResult.build);
    result.test.push(...goResult.test);
    result.lint.push(...goResult.lint);
    result.dev.push(...goResult.dev);
  }

  // Makefile — always check, adds to any language
  const makeResult = await detectMakefileCommands(dir);
  if (makeResult.build) result.build.push(...makeResult.build);
  if (makeResult.test) result.test.push(...makeResult.test);
  if (makeResult.lint) result.lint.push(...makeResult.lint);
  if (makeResult.dev) result.dev.push(...makeResult.dev);

  return result;
}
