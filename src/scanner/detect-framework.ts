import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FrameworkInfo, Language } from "./types.js";

interface FrameworkDef {
  dep: string;
  name: string;
  category: FrameworkInfo["category"];
}

const NODE_FRAMEWORKS: FrameworkDef[] = [
  { dep: "next", name: "Next.js", category: "web" },
  { dep: "nuxt", name: "Nuxt", category: "web" },
  { dep: "remix", name: "Remix", category: "web" },
  { dep: "astro", name: "Astro", category: "web" },
  { dep: "@sveltejs/kit", name: "SvelteKit", category: "web" },
  { dep: "svelte", name: "Svelte", category: "web" },
  { dep: "react", name: "React", category: "web" },
  { dep: "vue", name: "Vue", category: "web" },
  { dep: "@angular/core", name: "Angular", category: "web" },
  { dep: "express", name: "Express", category: "api" },
  { dep: "fastify", name: "Fastify", category: "api" },
  { dep: "@nestjs/core", name: "NestJS", category: "api" },
  { dep: "hono", name: "Hono", category: "api" },
];

const PYTHON_FRAMEWORKS: FrameworkDef[] = [
  { dep: "django", name: "Django", category: "web" },
  { dep: "flask", name: "Flask", category: "api" },
  { dep: "fastapi", name: "FastAPI", category: "api" },
  { dep: "streamlit", name: "Streamlit", category: "web" },
  { dep: "gradio", name: "Gradio", category: "web" },
];

const RUST_FRAMEWORKS: FrameworkDef[] = [
  { dep: "actix-web", name: "Actix Web", category: "api" },
  { dep: "axum", name: "Axum", category: "api" },
  { dep: "rocket", name: "Rocket", category: "api" },
  { dep: "tokio", name: "Tokio", category: "library" },
  { dep: "clap", name: "Clap", category: "cli" },
];

const GO_FRAMEWORKS: FrameworkDef[] = [
  { dep: "github.com/gin-gonic/gin", name: "Gin", category: "api" },
  { dep: "github.com/labstack/echo", name: "Echo", category: "api" },
  { dep: "github.com/gofiber/fiber", name: "Fiber", category: "api" },
  { dep: "github.com/spf13/cobra", name: "Cobra", category: "cli" },
];

async function safeReadFile(filepath: string): Promise<string | null> {
  try {
    return await readFile(filepath, "utf-8");
  } catch {
    return null;
  }
}

function detectNodeFrameworks(pkgContent: string): FrameworkInfo[] {
  const frameworks: FrameworkInfo[] = [];
  try {
    const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
    const deps = (pkg["dependencies"] ?? {}) as Record<string, unknown>;
    const devDeps = (pkg["devDependencies"] ?? {}) as Record<string, unknown>;
    const allDeps = { ...deps, ...devDeps };

    for (const fw of NODE_FRAMEWORKS) {
      if (fw.dep in allDeps) {
        frameworks.push({ name: fw.name, category: fw.category });
      }
    }
  } catch {
    // Invalid JSON — skip
  }
  return frameworks;
}

function detectPythonFrameworks(content: string): FrameworkInfo[] {
  const frameworks: FrameworkInfo[] = [];
  const lower = content.toLowerCase();

  for (const fw of PYTHON_FRAMEWORKS) {
    // Match dependency name in requirements.txt style (dep==, dep>=, dep\n)
    // or in pyproject.toml dependencies array
    if (lower.includes(fw.dep)) {
      frameworks.push({ name: fw.name, category: fw.category });
    }
  }
  return frameworks;
}

/**
 * Minimal TOML dependency parser — looks for [dependencies] section
 * and scans lines for known framework names.
 */
function detectRustFrameworks(cargoContent: string): FrameworkInfo[] {
  const frameworks: FrameworkInfo[] = [];

  // Find [dependencies] section
  const depsIdx = cargoContent.indexOf("[dependencies]");
  if (depsIdx === -1) return frameworks;

  // Extract text from [dependencies] to the next section header
  const afterDeps = cargoContent.slice(depsIdx);
  const nextSection = afterDeps.indexOf("\n[", 1);
  const depsSection =
    nextSection === -1 ? afterDeps : afterDeps.slice(0, nextSection);

  for (const fw of RUST_FRAMEWORKS) {
    // Match lines like: actix-web = "4" or actix-web = { version = "4" }
    if (depsSection.includes(fw.dep)) {
      frameworks.push({ name: fw.name, category: fw.category });
    }
  }
  return frameworks;
}

function detectGoFrameworks(goModContent: string): FrameworkInfo[] {
  const frameworks: FrameworkInfo[] = [];

  for (const fw of GO_FRAMEWORKS) {
    if (goModContent.includes(fw.dep)) {
      frameworks.push({ name: fw.name, category: fw.category });
    }
  }
  return frameworks;
}

export async function detectFrameworks(
  dir: string,
  languages: Language[],
): Promise<FrameworkInfo[]> {
  const frameworks: FrameworkInfo[] = [];

  if (languages.includes("typescript") || languages.includes("javascript")) {
    const content = await safeReadFile(join(dir, "package.json"));
    if (content) {
      frameworks.push(...detectNodeFrameworks(content));
    }
  }

  if (languages.includes("python")) {
    // Check multiple Python config files
    const pyproject = await safeReadFile(join(dir, "pyproject.toml"));
    const requirements = await safeReadFile(join(dir, "requirements.txt"));
    const pipfile = await safeReadFile(join(dir, "Pipfile"));
    const combined = [pyproject, requirements, pipfile]
      .filter(Boolean)
      .join("\n");
    if (combined) {
      frameworks.push(...detectPythonFrameworks(combined));
    }
  }

  if (languages.includes("rust")) {
    const content = await safeReadFile(join(dir, "Cargo.toml"));
    if (content) {
      frameworks.push(...detectRustFrameworks(content));
    }
  }

  if (languages.includes("go")) {
    const content = await safeReadFile(join(dir, "go.mod"));
    if (content) {
      frameworks.push(...detectGoFrameworks(content));
    }
  }

  return frameworks;
}
