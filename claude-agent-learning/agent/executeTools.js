export async function executeToolRequests(toolRequests, toolHandlers) {
  

  console.time("Tool Execution");

  const promises = toolRequests.map(async (toolRequest) => {
     
     const handlerObject = toolHandlers[toolRequest.name];
     

    if (!handlerObject) {
      return {
        type: "tool_result",
        tool_use_id: toolRequest.id,
        content: `Unknown tool: ${toolRequest.name}`,
        is_error: true,
      };

      
    }

    const {handler, validator} = handlerObject;

   

    try{
      if (validator){
        validator(toolRequest.input)
      }
     
      const result = await handler(toolRequest.input);

      console.log("Tool:", toolRequest.name);
      console.log("Results:", result)

    return {
      type: "tool_result",
      tool_use_id: toolRequest.id,
      content: JSON.stringify(result),
    };

    

    }catch (error) {
        console.log("Tool failed:", toolRequest.name);
        console.log("Error:", error.message);

        return {
            type: "tool_result",
            tool_use_id: toolRequest.id,
            content: `Tool Failed: ${error.message}`,
            is_error: true,
        }
    }
  });

  const toolResults = await Promise.all(promises);
  console.timeEnd("Tool Execution");

  return toolResults;
}