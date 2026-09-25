import Anthropic from "@anthropic-ai/sdk";
import { getProjectStatus, getProjectOwner } from "./tools/projectTools.js";
import { executeToolRequests } from "./agent/executeTools.js";


// ============================================================
// SETUP
// ============================================================

const client = new Anthropic();


// ============================================================
// TOOL DEFINITIONS
// Tell Claude which tools are available and what inputs they need.
// ============================================================

const tools = [
  {
    name: "get_project_status",
    description: "Get the current status of a project by its ID",
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
// TOOL REGISTRY
// Connect Claude's tool names to our JavaScript functions.
// ============================================================

const toolHandlers = {
  get_project_status: getProjectStatus,
  get_project_owner: getProjectOwner,
};





// ============================================================
// CONVERSATION
// ============================================================

const messages = [
  {
    role: "user",
    content: "What is the status of project 101 and what is the owner's email?",
  },
];


// ============================================================
// AGENT LOOP
// Claude → tool request → execute tools → Claude → final answer
// ============================================================

const MAX_ITERATIONS = 10;
let iteration = 0;

while (true) {
  iteration++;

  // Prevent the agent from looping forever.
  if (iteration > MAX_ITERATIONS) {
    console.log("Max agent iterations reached.");
    break;
  }

  console.log(`\n--- Agent iteration ${iteration} ---\n`);

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 200,
    tools,
    messages,
  });

  console.log("Stop reason:", message.stop_reason);
  console.dir(message.content, { depth: null });

  // Claude has finished answering.
  if (message.stop_reason === "end_turn") {
    console.log(message.content[0].text);
    break;
  }

  // Claude wants our application to execute tools.
  if (message.stop_reason === "tool_use") {
    const toolRequests = message.content.filter(
      (block) => block.type === "tool_use",
    );

    const toolResults = executeToolRequests(
      toolRequests,
      toolHandlers,
    );

    messages.push({
      role: "assistant",
      content: message.content,
    });

    messages.push({
      role: "user",
      content: toolResults,
    });
  }
}