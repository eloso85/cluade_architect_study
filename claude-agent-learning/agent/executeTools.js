export function executeToolRequests(toolRequests, toolHandlers) {
  const toolResults = [];

  for (const toolRequest of toolRequests) {
    const handler = toolHandlers[toolRequest.name];

    if (!handler) {
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolRequest.id,
        content: `Unknown tool: ${toolRequest.name}`,
        is_error: true,
      });

      continue;
    }

    const result = handler(toolRequest.input);

    toolResults.push({
      type: "tool_result",
      tool_use_id: toolRequest.id,
      content: JSON.stringify(result),
    });

    console.log("Tool:", toolRequest.name);
    console.log("Result:", result);
  }

  return toolResults;
}