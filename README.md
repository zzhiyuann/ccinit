# ccinit

[![CI](https://github.com/zzhiyuann/ccinit/actions/workflows/ci.yml/badge.svg)](https://github.com/zzhiyuann/ccinit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ccinit.svg)](https://www.npmjs.com/package/ccinit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Auto-generate Claude Code configuration from your codebase.

One command. Zero config. Your project is ready for Claude Code.

**[Landing page](https://zzhiyuann.github.io/ccinit/)** | **[npm](https://www.npmjs.com/package/ccinit)**

## Quick Start

```bash
npx ccinit
```

That's it. ccinit scans your project and generates:

- **CLAUDE.md** -- Build, test, lint commands and project conventions
- **.claude/settings.local.json** -- MCP server recommendations (Git, filesystem, Context7, and more)
- **.claude/commands/** -- Project-specific slash commands (test, dev, review, + framework-specific)

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

## Intelligent MCP Recommendations

ccinit recommends MCP servers based on your detected stack:

| Signal | MCP Server |
|--------|-----------|
| Any project | `@anthropic/mcp-filesystem` -- File browsing and search |
| Git repo | `@anthropic/mcp-git` -- Repository history and diffs |
| Has dependencies | `@upstash/context7-mcp` -- Documentation lookup |
| Web frontend (React, Vue, etc.) | `@anthropic/mcp-puppeteer` -- Browser automation |
| Database signals (Prisma, migrations) | `@anthropic/mcp-postgres` -- Schema inspection |

## Framework-Specific Commands

Beyond the standard `/test`, `/dev`, and `/review` commands, ccinit generates framework-specific slash commands:

| Framework | Commands |
|-----------|---------|
| Next.js | `/build-prod` -- Production build analysis |
| Django | `/migrate` -- Database migrations |
| FastAPI / Flask | `/routes` -- API endpoint listing |
| React / Vue / Svelte | `/component` -- Component analysis |
| Rust | `/check` -- Clippy analysis |
| Go | `/check` -- Static analysis |
| Database projects | `/schema` -- Data model exploration |

## Related

- [ccmanager](https://github.com/zzhiyuann/claude-code-manager) -- TUI to view all your Claude Code configurations
- [claude-code-skills](https://github.com/zzhiyuann/claude-code-skills) -- Custom slash commands for Claude Code

## License

MIT
