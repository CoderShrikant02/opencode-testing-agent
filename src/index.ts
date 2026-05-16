import type { Plugin } from "@opencode-ai/plugin"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

// ─── Framework Detection Logic ────────────────────────────────────────────────

type Framework = "pytest" | "jest" | "vitest" | "gotest" | "unknown"

interface DetectionResult {
  framework: Framework
  confidence: "high" | "medium" | "low"
  reason: string
  runCommand: string
  filePattern: string
  fileLocation: string
}

function detectFramework(projectRoot: string): DetectionResult {
  // 1. Go — check go.mod first (most definitive)
  if (existsSync(join(projectRoot, "go.mod"))) {
    return {
      framework: "gotest",
      confidence: "high",
      reason: "go.mod found",
      runCommand: "go test ./... -v",
      filePattern: "*_test.go",
      fileLocation: "same package as source",
    }
  }

  // 2. Python — check multiple signals
  const isPython =
    existsSync(join(projectRoot, "requirements.txt")) ||
    existsSync(join(projectRoot, "pyproject.toml")) ||
    existsSync(join(projectRoot, "setup.py")) ||
    existsSync(join(projectRoot, "Pipfile"))

  if (isPython) {
    return {
      framework: "pytest",
      confidence: "high",
      reason: "Python project files found",
      runCommand: "python -m pytest tests/ -v --tb=short",
      filePattern: "test_*.py",
      fileLocation: "tests/ directory",
    }
  }

  // 3. JS/TS — read package.json for jest vs vitest
  const pkgPath = join(projectRoot, "package.json")
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      }

      if (allDeps["vitest"]) {
        return {
          framework: "vitest",
          confidence: "high",
          reason: "vitest found in package.json",
          runCommand: "npx vitest run",
          filePattern: "*.test.ts / *.spec.ts",
          fileLocation: "alongside source files",
        }
      }

      if (allDeps["jest"] || allDeps["@jest/core"]) {
        return {
          framework: "jest",
          confidence: "high",
          reason: "jest found in package.json",
          runCommand: "npx jest --verbose",
          filePattern: "*.test.ts / *.spec.ts",
          fileLocation: "alongside source files",
        }
      }

      // Has package.json but no test framework installed
      return {
        framework: "jest",
        confidence: "medium",
        reason: "JS project detected, defaulting to jest (not yet installed)",
        runCommand: "npx jest --verbose",
        filePattern: "*.test.ts",
        fileLocation: "alongside source files",
      }
    } catch {
      // package.json exists but unreadable
    }
  }

  return {
    framework: "unknown",
    confidence: "low",
    reason: "No recognisable project files found",
    runCommand: "",
    filePattern: "",
    fileLocation: "",
  }
}

// ─── Agent Prompt Builder ─────────────────────────────────────────────────────

function buildSystemPrompt(detection: DetectionResult): string {
  const frameworkGuide: Record<Framework, string> = {
    pytest: `
## Framework: pytest (Python)
- Files: \`tests/test_*.py\`
- Functions: \`def test_*()\`
- Use \`@pytest.fixture\` for shared setup
- Use \`@pytest.mark.parametrize\` for data-driven tests
- Use \`pytest.raises(ExceptionType)\` for error cases
- Run: \`${detection.runCommand}\`

### Template
\`\`\`python
import pytest
from <module> import <function>

@pytest.fixture
def sample():
    return {...}

def test_happy_path(sample):
    assert <function>(sample) == expected

@pytest.mark.parametrize("inp,exp", [(..., ...), (..., ...)])
def test_edge_cases(inp, exp):
    assert <function>(inp) == exp

def test_raises_on_invalid():
    with pytest.raises(ValueError):
        <function>(invalid)
\`\`\`
`,
    jest: `
## Framework: jest (JavaScript/TypeScript)
- Files: \`*.test.ts\` or \`*.spec.ts\` alongside source
- Use \`describe\` / \`it\` / \`expect\`
- Mock with \`jest.mock()\`
- Run: \`${detection.runCommand}\`

### Template
\`\`\`typescript
import { describe, it, expect, jest } from '@jest/globals'
import { fn } from './<module>'

describe('<module>', () => {
  it('returns correct result', () => {
    expect(fn(input)).toBe(expected)
  })
  it('throws on invalid input', () => {
    expect(() => fn(null)).toThrow()
  })
})
\`\`\`
`,
    vitest: `
## Framework: vitest (TypeScript)
- Files: \`*.test.ts\` or \`*.spec.ts\` alongside source
- Use \`describe\` / \`it\` / \`expect\` from 'vitest'
- Mock with \`vi.mock()\`
- Run: \`${detection.runCommand}\`

### Template
\`\`\`typescript
import { describe, it, expect, vi } from 'vitest'
import { fn } from './<module>'

describe('<module>', () => {
  it('returns correct result', () => {
    expect(fn(input)).toBe(expected)
  })
  it('handles async', async () => {
    await expect(asyncFn()).resolves.toEqual(expected)
  })
})
\`\`\`
`,
    gotest: `
## Framework: go test (Go)
- Files: \`*_test.go\` in same package as source
- Functions: \`func TestXxx(t *testing.T)\`
- Use table-driven tests with \`t.Run\`
- Run: \`${detection.runCommand}\`

### Template
\`\`\`go
package <package>

import "testing"

func TestFunctionName(t *testing.T) {
    tests := []struct {
        name    string
        input   InputType
        want    OutputType
        wantErr bool
    }{
        {"happy path", validIn, expectedOut, false},
        {"invalid input", badIn, zero, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := FunctionName(tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
            }
            if got != tt.want {
                t.Errorf("got %v, want %v", got, tt.want)
            }
        })
    }
}
\`\`\`
`,
    unknown: `
## Framework: Unknown
I could not detect a test framework. Please tell me:
- What language is this project? (Python / JS / TS / Go / other)
- Do you have a testing framework installed?
I will set up the right one for you.
`,
  }

  return `You are the **Testing Agent** for this project, powered by the opencode-testing-agent plugin.

## Auto-detected project info
- Framework: **${detection.framework}** (${detection.confidence} confidence)
- Reason: ${detection.reason}
- Test files go in: ${detection.fileLocation}
- Test file pattern: ${detection.filePattern}

${frameworkGuide[detection.framework]}

## Your workflow — follow this EVERY session

### Step 1: Ask mode (once per session only)
Ask the user:
> "Should I **suggest-only** (write tests, you run them) or **auto-run** (write + execute + report)?"
Remember their answer. Never ask again this session.

### Step 2: Read before writing
Always read the target file first. Understand what the code does before writing any test.

### Step 3: Write complete tests
Cover all three cases minimum:
- ✅ Happy path (valid input, correct output)
- ⚠️  Edge cases (empty, null, boundary values)
- ❌ Error cases (invalid input, exceptions)

### Step 4: Mode behaviour
**Suggest-only:** Write the file, explain each test, end with:
> "Review the tests. Run with: \`${detection.runCommand}\`"

**Auto-run:** Write the file → execute → parse output → report:
\`\`\`
✅ Passed: X  ❌ Failed: Y
Failed tests:
- test_name: <error message>
\`\`\`
If tests fail, suggest a fix but do NOT auto-apply without asking.

## Rules
- Never delete existing tests. Only add.
- Read existing test files before editing.
- Keep tests clean — no TODO stubs, no commented-out tests.
- Always tell the user the exact run command.`
}

// ─── Plugin Export ─────────────────────────────────────────────────────────────

export const TestingAgentPlugin: Plugin = async (ctx) => {
  const projectRoot = ctx.project?.worktree ?? ctx.directory ?? "."
  const detection = detectFramework(projectRoot)

  // Log detection result for user visibility
  await ctx.client.app.log({
    body: {
      service: "opencode-testing-agent",
      level: "info",
      message: `Framework detected: ${detection.framework} (${detection.confidence} confidence) — ${detection.reason}`,
    },
  })

  return {
    // Inject the testing agent configuration when the session starts
    "session.started": async (_input, _output) => {
      await ctx.client.app.log({
        body: {
          service: "opencode-testing-agent",
          level: "info",
          message: "Testing agent ready. Use @testing to invoke.",
        },
      })
    },
  }
}

export default TestingAgentPlugin
