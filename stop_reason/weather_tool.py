"""The weather tool used by the stop_reason demo — a Claude Agent SDK in-process
MCP tool, not a raw Messages API tool dict.

The Agent SDK never lets you hand Claude a bare JSON schema the way the
Messages API does. Instead:

  * `@tool(...)` wraps an async handler and declares its name, description and
    input shape - this is what becomes a `ToolUseBlock` in the message stream.
  * `create_sdk_mcp_server(...)` bundles one or more `@tool`-decorated
    functions into an in-process MCP server (no subprocess, no IPC - it runs
    in this Python process).
  * The server goes on `ClaudeAgentOptions.mcp_servers`, and the tool's wire
    name becomes `mcp__<server_name>__<tool_name>` - that longer name is what
    you put in `allowed_tools` and what shows up on `ToolUseBlock.name`.

The handler itself follows a different contract than a Messages API tool
function too: it returns a dict shaped like an MCP `CallToolResult`
(`{"content": [...], "is_error": ...}`), not a bare string. An exception
raised inside the handler is caught by the SDK and reported to Claude as an
error result automatically - it never needs a try/except of its own for that.
"""

from __future__ import annotations

from claude_agent_sdk import create_sdk_mcp_server, tool

# Canned observations: city (lowercase) -> (celsius, conditions, humidity %)
_OBSERVATIONS = {
    "paris": (18, "partly cloudy", 61),
    "london": (14, "light rain", 78),
    "tokyo": (24, "clear", 55),
    "san francisco": (16, "foggy", 84),
    "new york": (21, "sunny", 47),
    "sydney": (26, "sunny", 52),
    "reykjavik": (6, "windy with sleet", 88),
}


def _format_report(location: str, unit: str) -> str:
    celsius, conditions, humidity = _OBSERVATIONS[location.strip().lower()]
    temperature = f"{round(celsius * 9 / 5 + 32)}°F" if unit == "fahrenheit" else f"{celsius}°C"
    return f"{location.title()}: {temperature}, {conditions}, humidity {humidity}%."


@tool(
    "get_weather",
    "Get the current weather for a city. Returns temperature, conditions and "
    "humidity. Call once per city.",
    {
        "location": str,  # e.g. "Paris" or "Tokyo"
        "unit": str,      # "celsius" or "fahrenheit"
    },
)
async def get_weather(args: dict) -> dict:
    """Handler behind the `get_weather` tool. Returns an MCP-shaped result dict."""
    location = args["location"]
    unit = args.get("unit", "celsius")

    if location.strip().lower() not in _OBSERVATIONS:
        known = ", ".join(sorted(name.title() for name in _OBSERVATIONS))
        return {
            "content": [{
                "type": "text",
                "text": f"No weather station for {location!r}. Known cities: {known}.",
            }],
            "is_error": True,
        }

    return {"content": [{"type": "text", "text": _format_report(location, unit)}]}


# Wire name Claude actually sees: mcp__weather__get_weather
WEATHER_SERVER = create_sdk_mcp_server("weather", tools=[get_weather])
WEATHER_TOOL_NAME = "mcp__weather__get_weather"
