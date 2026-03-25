import { access } from "node:fs/promises";
import { join } from "node:path";
import type { Language } from "./types.js";

export interface LanguageResult {
  primary: Language;
  all: Language[];
}

interface LanguageCheck {
  files: string[];
  language: Language;
  /** If set, also check this secondary condition to refine detection */
  refine?: {
    files: string[];
    refinedLanguage: Language;
  };
}

const LANGUAGE_CHECKS: LanguageCheck[] = [
  {
    files: ["package.json"],
    language: "javascript",
    refine: {
      files: ["tsconfig.json"],
      refinedLanguage: "typescript",
    },
  },
  { files: ["Cargo.toml"], language: "rust" },
  {
    files: ["pyproject.toml", "setup.py", "requirements.txt", "Pipfile"],
    language: "python",
  },
  { files: ["go.mod"], language: "go" },
  { files: ["Gemfile"], language: "ruby" },
  { files: ["pom.xml", "build.gradle", "build.gradle.kts"], language: "java" },
  { files: ["Package.swift"], language: "swift" },
];

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if package.json has typescript in devDependencies.
 */
async function hasTypescriptDep(dir: string): Promise<boolean> {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(join(dir, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const devDeps = pkg["devDependencies"] as
      | Record<string, unknown>
      | undefined;
    const deps = pkg["dependencies"] as Record<string, unknown> | undefined;
    return !!(devDeps?.["typescript"] ?? deps?.["typescript"]);
  } catch {
    return false;
  }
}

/**
 * Detect C# projects by looking for *.csproj or *.sln files in the root.
 */
async function detectCsharp(dir: string): Promise<boolean> {
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(dir);
    return entries.some(
      (e) => e.endsWith(".csproj") || e.endsWith(".sln"),
    );
  } catch {
    return false;
  }
}

/**
 * Detect Swift/Xcode projects by looking for .xcodeproj, .xcworkspace, or project.yml.
 */
async function detectXcodeProject(dir: string): Promise<boolean> {
  // Check project.yml (XcodeGen)
  if (await fileExists(join(dir, "project.yml"))) return true;

  // Check for .xcodeproj or .xcworkspace directories
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(dir);
    return entries.some(
      (e) => e.endsWith(".xcodeproj") || e.endsWith(".xcworkspace"),
    );
  } catch {
    return false;
  }
}

export async function detectLanguages(dir: string): Promise<LanguageResult> {
  const detected: Language[] = [];

  for (const check of LANGUAGE_CHECKS) {
    let found = false;
    for (const file of check.files) {
      if (await fileExists(join(dir, file))) {
        found = true;
        break;
      }
    }
    if (!found) continue;

    let lang = check.language;

    // Refine: e.g. javascript -> typescript if tsconfig.json exists
    if (check.refine) {
      for (const refineFile of check.refine.files) {
        if (await fileExists(join(dir, refineFile))) {
          lang = check.refine.refinedLanguage;
          break;
        }
      }
      // Also check devDependencies for typescript
      if (lang === "javascript" && (await hasTypescriptDep(dir))) {
        lang = "typescript";
      }
    }

    if (!detected.includes(lang)) {
      detected.push(lang);
    }
    // If we refined to typescript, also include javascript
    if (lang === "typescript" && !detected.includes("javascript")) {
      // Don't add javascript separately — typescript implies it
    }
  }

  // Check C# separately (glob-based)
  if (await detectCsharp(dir)) {
    if (!detected.includes("csharp")) {
      detected.push("csharp");
    }
  }

  // Check Swift/Xcode separately (xcodeproj, xcworkspace, project.yml)
  if (!detected.includes("swift") && (await detectXcodeProject(dir))) {
    detected.push("swift");
  }

  const primary = detected[0] ?? "unknown";
  const all = detected.length > 0 ? detected : (["unknown"] as Language[]);

  return { primary, all };
}
