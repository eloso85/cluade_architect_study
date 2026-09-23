"""stop_reason in the Claude Agent SDK, with a weather tool.

This uses `claude_agent_sdk` (the package built around the Claude Code CLI),
not the raw `anthropic` Messages API. That choice changes where `stop_reason`
lives:

  * `AssistantMessage` (one per model turn) *has* a `stop_reason` field on its
    dataclass - but in this SDK's message stream it is consistently `None`.
    The SDK's internal agent loop already consumed the raw API's stop_reason
    to decide whether to run a tool and continue; it doesn't re-surface that
    decision to you turn by turn.
  * `ResultMessage` (one per `query()` call, at the very end) is where the
    real value shows up, alongside `terminal_reason` (why the *query loop*
    ended - "completed", "max_turns", "aborted_streaming", "aborted_tools"),
    `subtype`, and `is_error`.

Every scenario here calls the real SDK against the real API - each run costs
real tokens (small: a handful of cents total at low `max_turns`).

    python main.py                  # run every scenario
    python main.py tool_use         # run one
    python main.py --list           # list scenario names

Needs credentials the CLI can already see (this SDK shells out to a bundled
`claude` binary) - if you're running this from inside a Claude Code session,
that's already true.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import anyio

from claude_agent_sdk import ClaudeAgentOptions, ProcessError, ResultError, ResultMessage, query

from lib import sdk_parser as parser
from weather_tool import WEATHER_SERVER, WEATHER_TOOL_NAME

MODEL = "claude-opus-5"


async def run_query(prompt: str, *, max_turns: int = 6, use_tools: bool = True,
                    system_prompt: str = "Use the weather tool when asked about weather. Be terse.") -> ResultMessage | None:
    """Run one `query()` call, logging every message, and return its ResultMessage.

    Returns None if the CLI process raised before emitting one (this happens
    on some non-`max_turns` failures; the max_turns scenario handles its own
    exception separately since it raises *after* a ResultMessage is yielded).
    """
    options = ClaudeAgentOptions(
        model=MODEL,
        tools=[],  # disable built-in tools - only the MCP tool below is offered
        mcp_servers={"weather": WEATHER_SERVER} if use_tools else {},
        allowed_tools=[WEATHER_TOOL_NAME] if use_tools else [],
        system_prompt=system_prompt,
        max_turns=max_turns,
    )
    parser.log_query_start(prompt, model=MODEL,
                           tools=[WEATHER_TOOL_NAME] if use_tools else [], max_turns=max_turns)

    result: ResultMessage | None = None
    async for message in query(prompt=prompt, options=options):
        parser.log_message(message)
        if isinstance(message, ResultMessage):
            result = message
    return result


def show(prompt: str, **kwargs) -> None:
    """Run one scenario, surfacing a max_turns cutoff as a labelled event rather
    than an uncaught crash - that cutoff is itself part of what this scenario
    demonstrates."""
    async def _run() -> None:
        await run_query(prompt, **kwargs)

    try:
        anyio.run(_run)
    except (ResultError, ProcessError) as exc:
        parser.note(f"query() raised after the ResultMessage above: {type(exc).__name__}: {exc}")
        parser.note("This is expected when terminal_reason == 'max_turns' - the CLI process")
        parser.note("exits non-zero even though it already told you why via ResultMessage.")


# --------------------------------------------------------------------------
# scenarios
# --------------------------------------------------------------------------


def scenario_end_turn() -> None:
    """Claude answers without touching the tool."""
    parser.banner(
        "1. stop_reason: end_turn",
        "The tool is offered but not needed - ResultMessage.stop_reason ends up 'end_turn'.",
    )
    show("In one sentence, what does a barometer measure?")


def scenario_tool_use() -> None:
    """The canonical tool round trip, and where stop_reason actually surfaces."""
    parser.banner(
        "2. stop_reason: tool_use, but not where you'd expect",
        "Watch AssistantMessage.stop_reason stay None on every turn below - "
        "only the trailing ResultMessage carries a real value.",
    )
    show("What's the weather in Paris right now? Use celsius.")


def scenario_parallel_tools() -> None:
    """Multiple cities - and how 'parallel' tool calls look in this SDK."""
    parser.banner(
        "3. Multiple tool calls in one query",
        "In the raw Messages API, parallel tool_use blocks share one response. "
        "In this SDK each arrives as its own AssistantMessage - dispatched "
        "before their tool_results come back, but never batched into one message.",
    )
    show("Compare the current weather in Tokyo, London and Sydney in celsius. "
         "Which is warmest?")


def scenario_tool_error() -> None:
    """A tool_result carrying is_error: True."""
    parser.banner(
        "4. A failing tool call",
        "The @tool handler returns is_error: True for an unknown city - the "
        "loop recovers on its own; ResultMessage still ends up 'end_turn'.",
    )
    show("What's the weather in Atlantis? If you can't get it, say so and tell me "
         "about Tokyo instead.")


def scenario_max_turns() -> None:
    """ResultMessage.stop_reason == 'tool_use' when the turn budget runs out mid-call."""
    parser.banner(
        "5. stop_reason: tool_use via a max_turns cutoff",
        "max_turns=1 doesn't leave room to run the tool and continue. "
        "ResultMessage still reports stop_reason='tool_use' - and then query() "
        "raises, because the CLI process exits non-zero on this outcome.",
    )
    show("What's the weather in Paris?", max_turns=1)


SCENARIOS = {
    "end_turn": scenario_end_turn,
    "tool_use": scenario_tool_use,
    "parallel": scenario_parallel_tools,
    "tool_error": scenario_tool_error,
    "max_turns": scenario_max_turns,
}


# --------------------------------------------------------------------------
# entry point
# --------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    cli = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    cli.add_argument("scenarios", nargs="*", metavar="SCENARIO",
                     help=f"scenario names to run (default: all). One of: {', '.join(SCENARIOS)}")
    cli.add_argument("--list", action="store_true", help="list scenario names and exit")
    cli.add_argument("--no-color", action="store_true", help="disable ANSI colour")
    args = cli.parse_args(argv)

    parser.configure(colour=False if args.no_color else None)

    if args.list:
        for name, fn in SCENARIOS.items():
            print(f"  {name:<12} {(fn.__doc__ or '').strip()}")
        return 0

    unknown = [name for name in args.scenarios if name not in SCENARIOS]
    if unknown:
        cli.error(f"unknown scenario(s): {', '.join(unknown)}. "
                  f"Choose from: {', '.join(SCENARIOS)}")

    selected = args.scenarios or list(SCENARIOS)

    parser.log_stop_reason_table()
    for name in selected:
        SCENARIOS[name]()

    print()
    parser.rule("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
