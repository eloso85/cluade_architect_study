// ============================================================
// 1. SETUP
// ============================================================

import Anthropic from "@anthropic-ai/sdk";

// Create the Anthropic client.
// The API key is loaded from our .env file when Node starts.
const client = new Anthropic();


// ============================================================
// 2. TOOL DEFINITIONS
// ============================================================
// These definitions tell CLAUDE what tools are available.
//
// IMPORTANT:
// These do NOT execute our JavaScript functions.
// They are descriptions of capabilities Claude may request.
// ============================================================

const tools = [
  {
    name: "get_project_status",
    description: "Get the current status of a project by its ID",

    // Defines what input Claude must provide when requesting this tool.
    input_schema: {
      type: "object",

      properties: {
        projectId: {
          type: "number",
          description: "The ID of the project",
        },
      },

      required: ["projectId"],
    },
  },

  {
    name: "get_project_owner",
    description: "Get the owner information of a project by its ID",

    input_schema: {
      type: "object",

      properties: {
        projectId: {
          type: "number",
          description: "The ID of the project",
        },
      },

      required: ["projectId"],
    },
  },
];


// ============================================================
// 3. TOOL FUNCTIONS
// ============================================================
// These are REAL JavaScript functions.
//
// Claude cannot execute these directly.
// Our agent runtime will execute them when Claude requests
// the corresponding tool.
// ============================================================

function getProjectStatus({projectId}) {
  return {
    id: projectId,
    status: "Behind Schedule",
    owner: "Sarah",
  };
}

function getProjectOwner({projectId}) {
  return {
    projectId: projectId,
    owner: "Sarah",
    email: "sarah@example.com",
  };
}


// ============================================================
// 4. TOOL HANDLER REGISTRY
// ============================================================
// Maps Claude's tool names to our actual JavaScript functions.
//
// Claude name                  JavaScript function
// ------------------------------------------------------------
// get_project_status      ->   getProjectStatus
// get_project_owner       ->   getProjectOwner
// ============================================================

const toolHandlers = {
  get_project_status: getProjectStatus,
  get_project_owner: getProjectOwner,
};


// ============================================================
// 5. CONVERSATION HISTORY
// ============================================================
// This array stores the conversation that we send to Claude.
//
// It starts with the user's question.
// During the agent loop, we will add:
//   - Claude's tool requests
//   - our tool results
// ============================================================

const messages = [
  {
    role: "user",
    content: "What is the status of project 101 and what is the owner's email?",
  },
];


// ============================================================
// 6. AGENT LOOP
// ============================================================
//
// Keep calling Claude until Claude says the turn is finished.
//
// Claude
//   ↓
// tool_use? → execute tools → return results → call Claude again
//   ↓
// end_turn? → print final answer → stop loop
// ============================================================

function excuteToolRequests(toolRequests, toolHandlers) {
    const toolResults = [];
}

const MAX_ITERATIONS = 10;
let iteration = 0;

while (true) {
    iteration++;

    if (iteration > MAX_ITERATIONS) {
        console.log("Max agent iterations reached.")
        break;
    }

    console.log(`\n ---Agent iteration ${iteration} ---\n`);
  // ----------------------------------------------------------
  // STEP A: Send the current conversation to Claude
  // ----------------------------------------------------------

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 200,
    tools,
    messages,
  });

  console.log("Stop reason:", message.stop_reason);
  console.dir(message.content, { depth: null });


  // ----------------------------------------------------------
  // STEP B: Did Claude finish?
  // ----------------------------------------------------------

  if (message.stop_reason === "end_turn") {
    console.log(message.content[0].text);

    // Exit while(true)
    break;
  }


  // ----------------------------------------------------------
  // STEP C: Did Claude request tools?
  // ----------------------------------------------------------

  if (message.stop_reason === "tool_use") {

    // message.content may contain text AND tool requests.
    // Keep only blocks where type === "tool_use".
    const toolRequests = message.content.filter(
      (block) => block.type === "tool_use",
    );

    // We will collect every tool result here.
    const toolResults = [];


    // --------------------------------------------------------
    // STEP D: Execute each tool Claude requested
    // --------------------------------------------------------

    for (const toolRequest of toolRequests) {

      // Find the JavaScript function registered for this tool.
      const handler = toolHandlers[toolRequest.name];


      // SAFETY CHECK:
      // If no matching function exists, don't try to execute it.
      if (!handler) {
        toolResults.push({
            type: "tool_result",
            tool_use_id: toolRequest.id,
            content: `Unkown tool: ${toolRequest.name}`,
            is_error: true,
        })
        console.log("Unknown tool:", toolRequest.name);
        continue;
      }


      // Execute the real JavaScript function.
      //
      // Example:
      // handler(101)
      //
      // might actually mean:
      // getProjectStatus(101)
      const result = handler(toolRequest.input);


      // Package the result using Anthropic's expected format.
      //
      // tool_use_id connects this result to the exact
      // tool request Claude originally made.
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolRequest.id,
        content: JSON.stringify(result),
      });


      console.log("Tool:", toolRequest.name);
      console.log("Result:", result);
    }


    // --------------------------------------------------------
    // STEP E: Add Claude's tool requests to conversation history
    // --------------------------------------------------------

    messages.push({
      role: "assistant",
      content: message.content,
    });


    // --------------------------------------------------------
    // STEP F: Add our tool results to conversation history
    // --------------------------------------------------------

    messages.push({
      role: "user",
      content: toolResults,
    });

    // Nothing else happens here.
    //
    // We reach the bottom of while(true), so JavaScript
    // automatically goes back to the top and calls Claude again.
  }
}