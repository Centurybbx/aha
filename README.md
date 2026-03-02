# aha (MVP)

Minimal ReAct agent implementation with policy-guarded tools and LiteLLM provider support.

## Quickstart

```bash
uv sync
uv run aha chat --provider mock --prompt "hello"
```

## IM Serve (Telegram / Discord)

Install optional IM dependencies:

```bash
uv sync --extra im
# or Telegram only:
uv sync --extra telegram
```

Add channel config in `~/.aha/config.json`:

```json
{
  "provider": "litellm",
  "model": "openai/your-model-name",
  "api_key_env": "AHA_LLM_API_KEY",
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "<TELEGRAM_BOT_TOKEN>",
      "allow_from": ["123456789", "@your_username"],
      "allow_chats": ["123456789"]
    },
    "discord": {
      "enabled": false,
      "token": "",
      "allow_from": [],
      "allow_channels": []
    }
  },
  "im_auto_approve": false
}
```

Start IM runtime:

```bash
uv run aha serve
# alias:
uv run aha im
```

Notes:
- `im_auto_approve: false` keeps side-effect tools (write/shell) denied by default in IM mode.
- Empty `allow_from` / `allow_chats` means no whitelist restriction.
- Group chat responses use mention/reply gating.

## Real Model (LiteLLM)

Create `~/.aha/config.json`:

```json
{
  "provider": "litellm",
  "model": "openai/your-model-name",
  "endpoint": "https://your-llm-endpoint.example.com/v1",
  "api_key_env": "AHA_LLM_API_KEY",
  "request_timeout_seconds": 60
}
```

Set env var and run doctor:

```bash
export AHA_LLM_API_KEY="your-api-key"
uv run aha doctor --ping
```

Start chat:

```bash
uv run aha
```

### Auto Evolution (Scheduled Analyze + Manual Deploy)

You can configure scheduled self-improvement in `~/.aha/config.json`.
When `aha chat` starts, it will run periodic cycles:
`analyze -> propose -> validate` and stop before deploy (manual `evolve-deploy` is still required).

```json
{
  "provider": "litellm",
  "model": "openai/your-model-name",
  "api_key_env": "AHA_LLM_API_KEY",
  "evolution_enabled": true,
  "evolution_schedule": "daily",
  "evolution_skill_name": "planner",
  "evolution_run_on_startup": true
}
```

Schedule options:
- `evolution_schedule: \"daily\"` (every 24 hours)
- `evolution_schedule: \"weekly\"` (every 7 days)
- `evolution_schedule: \"custom\"` + `evolution_custom_interval_minutes`

Optional knobs:
- `evolution_dataset_overrides`: map dataset name to file path
- `evolution_baseline_file`: baseline result JSON path
- `evolution_llm_judge`: enable LLM-as-judge during scheduled validate
- `evolution_max_examples`: cap examples per dataset

Cycle outputs are written to:
- `memory/evolution/failure_reports.latest.json`
- `memory/evolution/latest.json`

## Runtime Logs

Runtime logs are separate from `memory/TRACE.jsonl`:
- `logs/aha.log`: runtime events for normal mode (`INFO` by default)
- `logs/aha.debug.log`: runtime events for debug mode (`DEBUG` by default)
- `memory/TRACE.jsonl`: agent trace/audit stream

Enable debug runtime logging:

```bash
uv run aha --debug
# or
uv run aha chat --debug
```

In debug mode, AHA streams a developer-readable trace to the console (turn/step/tool summaries, policy decisions, timings, errors).
It is redacted and does **not** print private chain-of-thought.

Example debug output:

```text
[chat] started session=... provider=... model=...
[turn] start session=... user_len=...
[step 1] model response latency=312ms tool_calls=1 text_len=0
[tool read_file] precheck allow=true confirm=false reason=allowed path=README.md
[tool read_file] run end ok=true duration=2ms warnings=0 redactions=0
[turn] final step=2 text_len=428
```
Disable console streaming if you only want the log file:

```bash
uv run aha --debug --no-debug-console
```

Override runtime logging:

```bash
uv run aha --log-level DEBUG --log-dir ./logs
uv run aha --no-runtime-log
```

View logs:

```bash
tail -n 200 logs/aha.log
tail -f logs/aha.debug.log
```

## Evals Commands

Export a redacted eval dataset from `memory/TRACE.jsonl`:

```bash
uv run aha eval-export --output memory/eval.dataset.jsonl
```

Summarize trace metrics:

```bash
uv run aha eval-metrics --output memory/eval.metrics.json
```

Run offline eval tasks (`.json` or `.jsonl`) and write experiment result:

```bash
uv run aha eval-run --provider mock --tasks ./benchmarks/core.json --output memory/eval.run.result.json
```

Enable optional LLM-as-Judge scoring (for samples with `rubric`):

```bash
uv run aha eval-run --provider litellm --tasks ./benchmarks/core.json --llm-judge
```

Run with regression gate against a baseline result:

```bash
uv run aha eval-run --provider mock --tasks ./benchmarks/core.json --baseline memory/eval.baseline.json
```

## Evolution Loop Commands

Generate failure reports from trace/eval records:

```bash
uv run aha evolve-analyze --output memory/failure_reports.json
```

Generate a `skill_patch` proposal:

```bash
uv run aha evolve-propose --failures memory/failure_reports.json --skill-name planner
```

Validate a proposal on eval tasks:

```bash
uv run aha evolve-validate --proposal-id <id> --tasks benchmarks/core.json --provider mock
```

Override additional validation datasets (repeat `--dataset-file`):

```bash
uv run aha evolve-validate \
  --proposal-id <id> \
  --tasks benchmarks/core.json \
  --dataset-file failure_replay=benchmarks/failure_replay.json \
  --dataset-file canary=benchmarks/canary.json \
  --provider mock
```

Deploy a validated proposal:

```bash
uv run aha evolve-deploy --proposal-id <id>
```

R3 proposals require double confirmation:

```bash
uv run aha evolve-deploy --proposal-id <id> --confirm-r3-risk --confirm-r3-rollback
```

Monitor online metrics and trigger alerts:

```bash
uv run aha evolve-monitor --baseline memory/eval.metrics.baseline.json
```

Continuous monitor loop:

```bash
uv run aha evolve-monitor --watch --interval-seconds 60 --max-iterations 10
```

Rollback a deployed skill change:

```bash
uv run aha evolve-rollback --skill-name planner
```

## Repo Hygiene

This repo keeps only source code and tests in Git by default. The following are local runtime artifacts and are ignored:
- `doc/` (local design/notes)
- `logs/`
- `memory/`
- `sessions/`
- `skills_local/`

Key resolution priority for `litellm`:
- `api_key` (direct in config) > `api_key_env` > no key
- No key is allowed for local/anonymous endpoints.

OpenRouter example:

```json
{
  "provider": "litellm",
  "model": "openrouter/anthropic/claude-3.5-sonnet",
  "api_key_env": "OPENROUTER_API_KEY",
  "endpoint": "https://openrouter.ai/api/v1"
}
```

## MVP Notes

- `ToolResult` now uses `data/redactions` as primary fields.
- Compatibility fields `output/meta` are still returned for MVP stability.
- `/new` slash command is supported inside `aha chat`.
- Benchmark datasets:
  - `benchmarks/core.json` (core regression)
  - `benchmarks/failure_replay.json` (known failures replay)
  - `benchmarks/canary.json` (exploratory/canary coverage)
- `skill_manager` supports governance actions:
  - `generate`, `check`, `diff`, `enable`, `disable`, `rollback`, `list`
  - compatibility aliases: `install -> generate`, `remove` (legacy delete)
  - `enable` requires a fresh `check` result (`PASS`/`WARN`) for current quarantine content
  - `check` returns normalized manifest + structured lint findings (`ERROR/WARN/INFO`) and risk flags
  - `diff`/`enable` expose unified diff + risk delta (`added/removed risk flags`)
  - `lock.json` entries include `pin` format: `name@version#hash`
  - runtime skill constraints are enforced when tool calls include `_source_skill` (and side-effecting calls are blocked if attribution is missing while active skills exist)
  - skill mutations are rate-limited and check records are integrity-signed

## Without uv (fallback)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
aha
```
