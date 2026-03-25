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

/** Check if a specific framework is detected. */
function hasFramework(profile: ProjectProfile, name: string): boolean {
  return profile.frameworks.some(
    (f) => f.name.toLowerCase() === name.toLowerCase(),
  );
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

  // Framework-specific commands
  const frameworkCommands = generateFrameworkCommands(profile);
  commands.push(...frameworkCommands);

  return commands;
}

/**
 * Generate framework-specific slash commands.
 */
function generateFrameworkCommands(
  profile: ProjectProfile,
): Array<{ name: string; content: string }> {
  const commands: Array<{ name: string; content: string }> = [];

  // Next.js / Nuxt — build production bundle
  if (hasFramework(profile, "Next.js") || hasFramework(profile, "Nuxt")) {
    const pm = profile.packageManager ?? "npm";
    commands.push({
      name: "build-prod",
      content: [
        `Build for production and analyze the output:`,
        `\`${pm} run build\``,
        ``,
        `Report bundle sizes, any warnings, and optimization suggestions.`,
        `$ARGUMENTS`,
      ].join("\n"),
    });
  }

  // Django — migrations and management commands
  if (hasFramework(profile, "Django")) {
    commands.push({
      name: "migrate",
      content: [
        `Run Django database migrations:`,
        `\`python manage.py migrate\` $ARGUMENTS`,
        ``,
        `If there are unapplied migrations, list them first with \`python manage.py showmigrations\`.`,
        `If asked to create migrations, use \`python manage.py makemigrations\`.`,
      ].join("\n"),
    });
  }

  // FastAPI / Flask — API documentation
  if (hasFramework(profile, "FastAPI") || hasFramework(profile, "Flask")) {
    commands.push({
      name: "routes",
      content: [
        `List all API routes/endpoints in this project:`,
        `$ARGUMENTS`,
        ``,
        `Search for route decorators (@app.get, @app.post, @router, @app.route) and present them as a table:`,
        `| Method | Path | Handler | Description |`,
      ].join("\n"),
    });
  }

  // React / Vue / Svelte — component exploration
  if (
    hasFramework(profile, "React") ||
    hasFramework(profile, "Vue") ||
    hasFramework(profile, "Svelte")
  ) {
    commands.push({
      name: "component",
      content: [
        `Analyze the specified component:`,
        `$ARGUMENTS`,
        ``,
        `Show: props/interface, state management, child components, event handlers.`,
        `Suggest improvements for accessibility, performance, and reusability.`,
      ].join("\n"),
    });
  }

  // Rust — cargo-specific commands
  if (profile.language === "rust") {
    commands.push({
      name: "check",
      content: [
        `Run Rust checks and report issues:`,
        `\`cargo clippy --all-targets --all-features 2>&1\``,
        `$ARGUMENTS`,
        ``,
        `Categorize findings by severity. Suggest fixes for each warning.`,
      ].join("\n"),
    });
  }

  // Go — go vet and related tooling
  if (profile.language === "go") {
    commands.push({
      name: "check",
      content: [
        `Run Go static analysis:`,
        `\`go vet ./...\``,
        `$ARGUMENTS`,
        ``,
        `Also check for common issues with \`go build ./...\` and report any errors.`,
      ].join("\n"),
    });
  }

  // Projects with database signals — schema exploration
  if (profile.directories.includes("migrations") || profile.directories.includes("prisma")) {
    commands.push({
      name: "schema",
      content: [
        `Analyze the database schema and migrations:`,
        `$ARGUMENTS`,
        ``,
        `Find schema definitions (Prisma schema, migration files, model definitions).`,
        `Present the current data model as a summary table with relationships.`,
      ].join("\n"),
    });
  }

  return commands;
}
