"""sdk_parser - formatting helpers for logging Claude Agent SDK message streams.

This module is presentation only. It never calls the SDK and never mutates the
objects it is handed; it turns the objects `claude_agent_sdk.query()` yields
into readable, colour-coded lines so that the two things this example is
about are easy to see:

  1. `stop_reason` - where it lives in this SDK, and why it is not where a
     Messages API user would expect it.
  2. `ResultMessage` - the one place per turn that carries an authoritative
     stop reason, and what its sibling fields (`terminal_reason`, `subtype`,
     `is_error`) add on top of it.

Everything here works against real `claude_agent_sdk` dataclasses (verified
against the installed package, not guessed): `SystemMessage`, `AssistantMessage`,
`UserMessage`, `ResultMessage`, `RateLimitEvent`, and the content-block types
`TextBlock` / `ThinkingBlock` / `ToolUseBlock` / `ToolResultBlock`.

Content blocks in this SDK are typed dataclasses with **no `.type` field** -
unlike the raw Messages API, where every block is a dict/model with a `type`
string. Block dispatch here goes through `_block_kind()`, which maps a
dataclass's Python class name to the same lowercase label the Messages API
would use, so the two vocabularies read the same on screen.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Sequence

from claude_agent_sdk import (
    AssistantMessage,
    ResultMessage,
    ServerToolResultBlock,
    ServerToolUseBlock,
    SystemMessage,
    TextBlock,
    ThinkingBlock,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
)

# --------------------------------------------------------------------------
# stop_reason reference
#
# These values are the same vocabulary the raw Messages API uses, because
# ResultMessage.stop_reason mirrors the stop_reason of the last underlying API
# turn in this exchange. The difference in this SDK is *where* it lands: not
# on every AssistantMessage (that field exists on the dataclass but is
# consistently None on this SDK's message stream - verified empirically),
# but once, on the final ResultMessage.
# --------------------------------------------------------------------------

STOP_REASONS: dict[Any, tuple[str, str]] = {
    "end_turn": ("Claude finished its answer on its own.", "Read ResultMessage.result."),
    "tool_use": (
        "The last API turn emitted tool_use - normally the SDK's internal loop "
        "already ran the tool(s) and continued. Seeing this on ResultMessage "
        "means the loop was cut off before it could (see terminal_reason).",
        "Check terminal_reason - most commonly max_turns.",
    ),
    "max_tokens": (
        "Generation hit the max_tokens ceiling mid-thought.",
        "ResultMessage.result is truncated.",
    ),
    "stop_sequence": ("Output matched a configured stop sequence.", "Rare in agentic use."),
    "pause_turn": (
        "A long-running server-side tool paused the turn.",
        "The SDK's internal loop resumes this on its own; you should not see it outlive a turn.",
    ),
    "refusal": ("Claude declined the request for safety reasons.", "ResultMessage.is_error is True."),
    None: (
        "Not set - true for every AssistantMessage in this SDK.",
        "Wait for ResultMessage; that is where stop_reason actually lands.",
    ),
}

_STOP_COLOURS = {
    "end_turn": "green",
    "tool_use": "cyan",
    "max_tokens": "yellow",
    "stop_sequence": "blue",
    "pause_turn": "magenta",
    "refusal": "red",
    None: "grey",
}

#: terminal_reason -> meaning. Values per ResultMessage.terminal_reason's docstring.
TERMINAL_REASONS: dict[Any, str] = {
    "completed": "The query loop ran to a normal finish.",
    "max_turns": "ClaudeAgentOptions.max_turns was reached before the loop finished.",
    "aborted_streaming": "Cancelled via ClaudeSDKClient.interrupt() while streaming.",
    "aborted_tools": "Cancelled via ClaudeSDKClient.interrupt() while a tool was running.",
    None: "Not reported (older CLI, or a result that bypassed the query loop).",
}

# --------------------------------------------------------------------------
# terminal plumbing (colour, glyphs, width) - presentation-only, no SDK ties
# --------------------------------------------------------------------------

_ANSI = {
    "reset": "\033[0m", "bold": "\033[1m", "dim": "\033[2m",
    "red": "\033[31m", "green": "\033[32m", "yellow": "\033[33m",
    "blue": "\033[34m", "magenta": "\033[35m", "cyan": "\033[36m", "grey": "\033[90m",
}
_GLYPHS_UNICODE = {"h": "─", "arrow_out": "→", "arrow_in": "←", "bullet": "•"}
_GLYPHS_ASCII = {"h": "-", "arrow_out": "->", "arrow_in": "<-", "bullet": "*"}

WIDTH = 78

_use_colour = True
_glyphs = _GLYPHS_ASCII


def _enable_windows_ansi() -> bool:
    if sys.platform != "win32":
        return True
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        handle = kernel32.GetStdHandle(-11)
        mode = ctypes.c_uint32()
        if not kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            return False
        return bool(kernel32.SetConsoleMode(handle, mode.value | 0x0004))
    except Exception:
        return False


def configure(colour: bool | None = None) -> None:
    """Set up colour and glyph support. Safe to call more than once."""
    global _use_colour, _glyphs

    if colour is None:
        colour = sys.stdout.isatty() and "NO_COLOR" not in os.environ
    _use_colour = bool(colour) and _enable_windows_ansi()

    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    except Exception:
        pass
    encoding = (getattr(sys.stdout, "encoding", "") or "").lower().replace("-", "")
    _glyphs = _GLYPHS_UNICODE if encoding.startswith("utf8") else _GLYPHS_ASCII


def paint(text: str, *styles: str) -> str:
    if not _use_colour or not styles:
        return text
    prefix = "".join(_ANSI[s] for s in styles if s in _ANSI)
    return f"{prefix}{text}{_ANSI['reset']}" if prefix else text


def truncate(value: Any, limit: int = 60) -> str:
    text = value if isinstance(value, str) else json.dumps(_jsonable(value), default=str)
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    ellipsis = "…" if _glyphs is _GLYPHS_UNICODE else "..."
    return text[: limit - len(ellipsis)] + ellipsis


def _jsonable(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return str(value)


def rule(title: str = "", style: str = "bold") -> None:
    line = _glyphs["h"]
    if not title:
        print(paint(line * WIDTH, "grey"))
        return
    body = f"{line * 3} {title} "
    print(paint(body + line * max(0, WIDTH - len(body)), style))


def banner(title: str, subtitle: str = "") -> None:
    print()
    rule(title, "bold")
    if subtitle:
        print(paint(f"    {subtitle}", "grey"))


def note(text: str) -> None:
    print(paint(f"    {text}", "grey"))


# --------------------------------------------------------------------------
# content-block dispatch
#
# claude_agent_sdk content blocks have no `.type` field - dispatch by class.
# --------------------------------------------------------------------------

_BLOCK_KIND = {
    TextBlock: "text",
    ThinkingBlock: "thinking",
    ToolUseBlock: "tool_use",
    ToolResultBlock: "tool_result",
    ServerToolUseBlock: "server_tool_use",
    ServerToolResultBlock: "server_tool_result",
}


def _block_kind(block: Any) -> str:
    return _BLOCK_KIND.get(type(block), type(block).__name__)


def describe_block(block: Any) -> str:
    """Render a single content block as one aligned line."""
    kind = _block_kind(block)
    label = paint(f"{kind:<12}", "bold")

    if isinstance(block, TextBlock):
        return f"{label} {paint(truncate(block.text, 58), 'grey')}"

    if isinstance(block, ThinkingBlock):
        return f"{label} {paint(truncate(block.thinking, 48), 'grey')}"

    if isinstance(block, (ToolUseBlock, ServerToolUseBlock)):
        return f"{label} {paint(block.name, 'cyan')}({truncate(block.input, 40)})  {paint(block.id, 'grey')}"

    if isinstance(block, ToolResultBlock):
        body = block.content
        if isinstance(body, list):
            body = " ".join(str(part.get("text", part)) if isinstance(part, dict) else str(part)
                            for part in body)
        flag = paint(" is_error", "red") if block.is_error else ""
        return f"{label} {paint(block.tool_use_id, 'grey')} {truncate(body, 40)}{flag}"

    if isinstance(block, ServerToolResultBlock):
        return f"{label} {paint(block.tool_use_id, 'grey')} {truncate(block.content, 40)}"

    return f"{label} {paint(truncate(block, 58), 'grey')}"


def summarise_content(content: Sequence[Any]) -> str:
    parts = []
    for block in content:
        if isinstance(block, (ToolUseBlock, ServerToolUseBlock)):
            parts.append(f"{_block_kind(block)}:{block.name}")
        elif isinstance(block, (ToolResultBlock, ServerToolResultBlock)):
            is_err = isinstance(block, ToolResultBlock) and block.is_error
            parts.append(_block_kind(block) + ("(is_error)" if is_err else ""))
        else:
            parts.append(_block_kind(block))
    return ", ".join(parts) if parts else "(empty)"


# --------------------------------------------------------------------------
# message dispatch - one function per claude_agent_sdk message type
# --------------------------------------------------------------------------


def log_query_start(prompt: str, *, model: str, tools: Sequence[str], max_turns: int | None) -> None:
    print()
    print(paint(f"  {_glyphs['arrow_out']} query()", "bold", "blue"))
    print(f"      {paint('prompt', 'grey'):<15} \"{truncate(prompt, 56)}\"")
    print(f"      {paint('model', 'grey'):<15} {model}")
    print(f"      {paint('tools', 'grey'):<15} {', '.join(tools) if tools else '(none)'}")
    print(f"      {paint('max_turns', 'grey'):<15} {max_turns}")


def log_system_message(message: SystemMessage) -> None:
    print(f"  {paint('SystemMessage', 'bold', 'grey')} subtype={message.subtype}  "
          f"(session init - fields omitted, they don't concern stop_reason)")


def log_assistant_message(message: AssistantMessage) -> None:
    print(f"  {paint('AssistantMessage', 'bold', 'magenta')} "
          f"stop_reason={paint(str(message.stop_reason), 'bold', _STOP_COLOURS.get(message.stop_reason, 'yellow'))}")
    for index, block in enumerate(message.content):
        print(f"      [{index}] {describe_block(block)}")
    if message.usage:
        print(f"      {paint('usage', 'grey')}  in={message.usage.get('input_tokens', 0)} "
              f"out={message.usage.get('output_tokens', 0)}")


def log_user_message(message: UserMessage) -> None:
    content = message.content if isinstance(message.content, list) else []
    print(f"  {paint('UserMessage', 'bold', 'blue')}  {summarise_content(content)}")
    for index, block in enumerate(content):
        print(f"      [{index}] {describe_block(block)}")


def log_result_message(message: ResultMessage) -> None:
    """The headline: the one place a real stop_reason lands in this SDK."""
    reason = message.stop_reason
    meaning, action = STOP_REASONS.get(reason, ("Unrecognised stop_reason.", "Inspect the raw message."))
    terminal_meaning = TERMINAL_REASONS.get(message.terminal_reason, "Unrecognised terminal_reason.")

    print()
    print(paint(f"  {_glyphs['arrow_in']} ResultMessage", "bold", "green"))
    print(f"      {paint('stop_reason', 'grey'):<16} "
          f"{paint(str(reason), 'bold', _STOP_COLOURS.get(reason, 'yellow'))}")
    print(f"      {paint('meaning', 'grey'):<16} {meaning}")
    print(f"      {paint('terminal_reason', 'grey'):<16} {message.terminal_reason}  "
          f"{paint(f'({terminal_meaning})', 'grey')}")
    print(f"      {paint('subtype', 'grey'):<16} {message.subtype}")
    print(f"      {paint('is_error', 'grey'):<16} "
          f"{paint(str(message.is_error), 'red' if message.is_error else 'green')}")
    print(f"      {paint('num_turns', 'grey'):<16} {message.num_turns}")
    if message.total_cost_usd is not None:
        print(f"      {paint('cost', 'grey'):<16} ${message.total_cost_usd:.4f}")
    if message.result is not None:
        print(f"      {paint('result', 'grey'):<16} {truncate(message.result, 56)}")
    if action:
        print(f"      {paint('next step', 'grey'):<16} {action}")


def log_other(message: Any) -> None:
    """Fallback for message types this demo doesn't focus on (rate limits, ...)."""
    print(paint(f"  {type(message).__name__}", "dim"))


def log_message(message: Any) -> None:
    """Dispatch a single message from `query()` to the right formatter."""
    if isinstance(message, SystemMessage):
        log_system_message(message)
    elif isinstance(message, AssistantMessage):
        log_assistant_message(message)
    elif isinstance(message, UserMessage):
        log_user_message(message)
    elif isinstance(message, ResultMessage):
        log_result_message(message)
    else:
        log_other(message)


def log_stop_reason_table() -> None:
    banner("stop_reason reference (Claude Agent SDK)",
           "Same vocabulary as the Messages API, but it lands only on ResultMessage.")
    for reason, (meaning, action) in STOP_REASONS.items():
        if reason is None:
            continue
        colour = _STOP_COLOURS.get(reason, "yellow")
        print(f"  {paint(f'{reason:<14}', 'bold', colour)}")
        print(f"      {meaning}")
        print(f"      {paint(action, 'grey')}")
    print()
    note("AssistantMessage.stop_reason exists on the dataclass but is consistently None")
    note("in this SDK's message stream - verified against a live run, not assumed.")
