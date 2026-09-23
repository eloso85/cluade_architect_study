# `stop_reason` in the Claude Agent SDK

This uses **`claude_agent_sdk`** (the package built around the Claude Code
CLI) — not the raw `anthropic` Messages API. That choice changes *where*
`stop_reason` lives, and that's the whole point of this example.

```
pip install -r requirements.txt
python main.py                      # run every scenario (real API calls, real cost)
python main.py tool_use             # run one
python main.py --list               # list scenario names
python main.py --no-color           # plain output for piping to a file
```

Needs credentials the CLI can already see — this SDK shells out to a bundled
`claude` binary (it ships one on Windows x64; installs its own on other
platforms). If you're running this from inside a Claude Code session, that's
already true.

**Every scenario is a real `query()` call against the real API.** Nothing here
is mocked. A full run of all five scenarios costs on the order of $0.05–0.10
at `claude-opus-5`.

## The finding

`AssistantMessage` — the type you get once per model turn — has a
`stop_reason` field on its dataclass. In a live run it is **always `None`**:

```python
AssistantMessage(content=[ToolUseBlock(...)], ..., stop_reason=None, ...)
```

The SDK's internal agent loop already consumed the raw Messages API's
`stop_reason` to decide "run this tool and continue" — it doesn't re-surface
that per-turn decision to your code. What you get instead is **one
`ResultMessage`, at the very end of the whole `query()` call**, carrying the
real value plus three fields that don't exist in the raw API at all:

```python
ResultMessage(
    stop_reason='end_turn',       # same vocabulary as the Messages API
    terminal_reason='completed',  # why the *query loop* ended
    subtype='success',
    is_error=False,
    result='Paris: 18°C, partly cloudy, 61% humidity.',
    ...
)
```

| Field | Where it comes from |
|---|---|
| `stop_reason` | Mirrors the underlying Messages API `stop_reason` of the last API turn in this exchange. |
| `terminal_reason` | CLI-level: why the *query loop* stopped — `completed`, `max_turns`, `aborted_streaming`, `aborted_tools`. |
| `subtype` | `success`, or an `error_*` variant matching the failure. |
| `is_error` | Bool summary of the above. |

## The scenario that proves it: `max_turns`

Scenario 5 sets `max_turns=1` on a prompt that needs the tool. The tool call
still runs (turn 1), but there's no turn left for Claude to read the result
and answer — and this is what actually happens, verified against a live run:

```
ResultMessage
    stop_reason      tool_use
    terminal_reason  max_turns
    subtype          error_max_turns
    is_error         True
```

Then `query()`'s async generator **raises** — after already yielding that
`ResultMessage`:

```
claude_agent_sdk.ResultError: Claude Code returned an error result:
Reached maximum number of turns (1) (exit code: 1)
```

The CLI subprocess exits non-zero on this outcome even though it already told
you why. `main.py`'s `show()` wraps every scenario in `try/except (ResultError,
ProcessError)` for exactly this reason — this is the pattern to copy, not an
edge case to ignore.

## Content blocks have no `.type` field

The other structural difference from the raw API: in `claude_agent_sdk`,
`TextBlock` / `ThinkingBlock` / `ToolUseBlock` / `ToolResultBlock` are typed
dataclasses with **no discriminator field**. You dispatch on the Python class
itself (`isinstance(block, ToolUseBlock)`), not on a `.type` string the way
you would with raw Messages API content blocks. `lib/sdk_parser.py`'s
`_block_kind()` maps each dataclass to the same lowercase label the Messages
API uses, purely so the output reads consistently — the SDK itself gives you
no such string.

## "Parallel" tool calls look different too

Scenario 3 asks about three cities. In the raw Messages API, simultaneous tool
calls arrive as multiple `tool_use` blocks inside **one** assistant response.
In this SDK, each tool call is its own separate `AssistantMessage` — the CLI
still dispatches Tokyo and London before either result comes back (you can see
both `AssistantMessage`s appear before their `UserMessage` tool results), but
they are never batched into one message's `content` list the way the raw API
does it.

## Files

| File | Role |
|---|---|
| `main.py` | Runs `query()` per scenario via `anyio`, logging every message. |
| `weather_tool.py` | `@tool`-decorated handler + `create_sdk_mcp_server(...)` — an in-process MCP tool, not a raw JSON-schema tool dict. |
| `lib/sdk_parser.py` | Formatting/logging only — dispatches on `claude_agent_sdk` dataclass types. Never calls the SDK itself. |

## The scenarios

| Name | Shows |
|---|---|
| `end_turn` | No tool needed — `ResultMessage.stop_reason == 'end_turn'` in one turn. |
| `tool_use` | The canonical round trip — `AssistantMessage.stop_reason` stays `None` throughout; `ResultMessage` carries the real answer. |
| `parallel` | Three cities — how this SDK represents concurrent tool dispatch (separate messages, not one batched turn). |
| `tool_error` | A `ToolResultBlock` with `is_error=True`, and the loop recovering on its own. |
| `max_turns` | `stop_reason='tool_use'` + `terminal_reason='max_turns'`, then the SDK raising `ResultError` after the fact. |

## Tool definition, the Agent SDK way

```python
@tool("get_weather", "Get the current weather for a city.", {"location": str, "unit": str})
async def get_weather(args: dict) -> dict:
    ...
    return {"content": [{"type": "text", "text": "..."}]}   # or {"is_error": True, ...}

WEATHER_SERVER = create_sdk_mcp_server("weather", tools=[get_weather])
```

The server goes on `ClaudeAgentOptions.mcp_servers={"weather": WEATHER_SERVER}`;
the tool's wire name becomes `mcp__weather__get_weather` — that's what goes in
`allowed_tools` and what shows up on `ToolUseBlock.name`. An exception raised
inside the handler is caught by the SDK and reported to Claude as an error
result automatically — no manual `try/except` needed for that part (the
"unknown city" case here still checks and returns `is_error` explicitly, so
the message text is under our control instead of being a raw traceback).

## Why not the raw Messages API?

The plan for this example was specifically to show `stop_reason` **within the
Claude Agent SDK**, not the underlying Messages API. An earlier pass of this
example used `anthropic.messages.create()` directly, which does put
`stop_reason` on every response — but that's a different library answering a
different question. This version stays on `claude_agent_sdk` throughout, which
is what makes the "it's not where you'd expect" finding above the actual
point of the exercise.
