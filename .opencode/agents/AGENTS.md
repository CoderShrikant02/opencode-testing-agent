# Project Testing Rules

## Testing Agent

This project uses the `testing` agent (invoke with `@testing` in OpenCode).

### Agents available
- `testing` — Primary agent. Detects framework, asks mode, writes/runs tests.
- `pytest-agent` — Python specialist (subagent, invoked internally).
- `jest-agent` — JS/TS specialist (subagent, invoked internally).
- `gotest-agent` — Go specialist (subagent, invoked internally).

### How to use
1. Open OpenCode in your project directory
2. Press Tab to switch to any primary agent, or type `@testing` to invoke directly
3. Say what you want tested, e.g.:
   - "Write tests for `utils/parser.py`"
   - "Test the `calculateTax` function in `billing.ts`"
   - "Write tests for the entire `auth` package"

### Test file locations
- Python: `tests/test_*.py`
- JS/TS: alongside source as `*.test.ts`
- Go: same package as `*_test.go`

### Mode reminder
The agent asks for mode at the start of each session:
- **Suggest-only** → writes tests, you run them
- **Auto-run** → writes and executes immediately, reports results
