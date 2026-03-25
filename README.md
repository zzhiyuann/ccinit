# ccinit

> Auto-generate Claude Code configuration from your codebase.

One command. Zero config. Your project is ready for Claude Code.

## Quick Start

```bash
npx ccinit
```

That's it. ccinit scans your project and generates:

- **CLAUDE.md** -- Build, test, lint commands and project conventions
- **.claude/settings.local.json** -- MCP server recommendations
- **.claude/commands/** -- Project-specific slash commands

## What It Detects

| Signal | Examples |
|--------|---------|
| Languages | TypeScript, Python, Rust, Go, Java, Ruby, C#, Swift |
| Frameworks | Next.js, React, FastAPI, Django, Axum, Gin, Express, NestJS |
| Build systems | npm/yarn/pnpm, cargo, pip/poetry/uv, go, make |
| Test runners | vitest, jest, pytest, cargo test, go test |
| Linters | ESLint, Prettier, Biome, ruff, black, clippy, golangci-lint |
| Dev servers | Detected from package.json scripts, uvicorn, flask run |
| Monorepos | npm/yarn/pnpm workspaces, Lerna, Cargo workspaces |

## Example Output

For a Next.js project, ccinit generates a CLAUDE.md like this:

```markdown
# my-app

## Build & Run
- `npm run build`

Dev server:
- `npm run dev`

## Test
- `npm run test`
- `npm run test path/to/file.test.ts` -- run a single test file

## Lint & Format
- `npm run lint`

## Project Structure
- `src/` -- Source code
- `app/` -- Application entry / pages
- `components/` -- UI components
- `public/` -- Static assets
- `tests/` -- Tests

## Tech Stack
- Language: TypeScript
- Framework: Next.js, React
- Package manager: npm

## Conventions
- TypeScript strict mode enabled
- ESM modules (`import`/`export`)
- ESLint configured -- fix all warnings
- Prettier configured -- format before committing
```

## Options

```
Usage: ccinit [options] [directory]

Arguments:
  directory          Project directory to scan (default: ".")

Options:
  --dry-run          Preview without writing files
  --force            Overwrite existing configuration
  --no-commands      Skip slash command generation
  --verbose          Show detection details
  -V, --version      Show version
  -h, --help         Show help
```

## Programmatic API

```typescript
import { scanProject, generateConfig } from "ccinit";

const profile = await scanProject("./my-project");
const config = generateConfig(profile);

console.log(config.claudeMd);    // CLAUDE.md content
console.log(config.settings);     // MCP server config
console.log(config.commands);     // Slash commands
```

## How It Works

1. **Scan** -- Reads package.json, Cargo.toml, pyproject.toml, go.mod, Makefile, and 40+ config files
2. **Detect** -- Identifies languages, frameworks, build/test/lint commands, and project structure
3. **Generate** -- Produces tailored CLAUDE.md, MCP settings, and slash commands
4. **Write** -- Saves files to your project (respects existing files unless `--force`)

## Related

- [ccmanager](https://github.com/zzhiyuann/claude-code-manager) -- TUI to view all your Claude Code configurations
- [claude-code-skills](https://github.com/zzhiyuann/claude-code-skills) -- Custom slash commands for Claude Code

## License

MIT
