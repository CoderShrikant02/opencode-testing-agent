# opencode-testing-agent

> A smart testing agent plugin for [OpenCode](https://opencode.ai) that auto-detects your framework and writes production-quality tests.

[![npm version](https://img.shields.io/npm/v/opencode-testing-agent)](https://www.npmjs.com/package/opencode-testing-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![OpenCode Plugin](https://img.shields.io/badge/opencode-plugin-blueviolet)](https://opencode.ai/docs/plugins)

---

## What it does

Instead of manually writing tests or guessing the right framework, just say:

```
@testing write tests for src/auth/login.py
```

The agent will:
1. **Auto-detect** your framework (pytest / jest / vitest / go test)
2. **Ask once** — suggest-only or auto-run?
3. **Read your code** before writing anything
4. **Write complete tests** — happy path, edge cases, error cases
5. *(Auto-run mode)* **Execute + report** pass/fail results

---

## Supported frameworks

| Language | Framework | Detection signal |
|---|---|---|
| Python | pytest | `requirements.txt`, `pyproject.toml`, `setup.py`, `Pipfile` |
| JavaScript | jest | `jest` in `package.json` devDependencies |
| TypeScript | vitest | `vitest` in `package.json` devDependencies |
| Go | go test | `go.mod` present |

---

## Install

### Step 1 — Add to your opencode.json

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-testing-agent"]
}
```

Place this in:
- `~/.config/opencode/opencode.json` → works for ALL your projects (global)
- `.opencode/opencode.json` → works only for this project (local)

### Step 2 — Copy the agent file

Copy `agents/testing.md` from this repo to your project's `.opencode/agents/` folder:

```bash
mkdir -p .opencode/agents
curl -o .opencode/agents/testing.md \
  https://raw.githubusercontent.com/YOUR_USERNAME/opencode-testing-agent/main/agents/testing.md
```

### Step 3 — Open OpenCode and invoke

```bash
opencode
```

Then in the TUI:
```
@testing write tests for src/utils/parser.py
```

---

## Usage examples

```
@testing write tests for src/auth/login.py
@testing test the calculateTax function in billing.ts
@testing write tests for the entire handlers/ package
@testing I just added a new function, test it
```

---

## Modes

The agent asks **once per session**:

| Mode | What happens |
|---|---|
| **Suggest-only** | Writes test files. You review and run manually. |
| **Auto-run** | Writes + executes tests. Reports pass/fail in chat. |

---

## How detection works

On startup, the plugin reads your project root and checks in this order:

1. `go.mod` → Go project → **go test**
2. `requirements.txt` / `pyproject.toml` / `setup.py` / `Pipfile` → Python → **pytest**
3. `package.json` with `vitest` in deps → **vitest**
4. `package.json` with `jest` in deps → **jest**
5. `package.json` (no test framework) → **jest** (suggested as default)

Detection confidence (`high` / `medium` / `low`) is logged at startup.

---

## Project structure

```
opencode-testing-agent/
├── src/
│   └── index.ts          # Plugin — framework detector + session hooks
├── agents/
│   └── testing.md        # Testing agent system prompt
├── package.json
└── README.md
```

---

## Contributing

PRs welcome! Ideas for next versions:
- [ ] Coverage report parsing
- [ ] Auto-fix failing tests (with user confirmation)
- [ ] Support for more frameworks (pytest-bdd, playwright, mocha)
- [ ] Test quality scoring

---

## License

MIT © Shrikant Chiddarwar
