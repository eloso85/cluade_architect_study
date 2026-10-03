import Anthropic from "@anthropic-ai/sdk";
import { getProjectStatus, getProjectOwner } from "./tools/projectTools.js";
import { executeToolRequests } from "./agent/executeTools.js";
import { getUser, findUserByName }  from "./tools/userTools.js";
import { getPostsForUser } from "./tools/postTools.js"; 


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
  {
    name: "get_user",
    description: "Get user information by user ID",
    input_schema: {
        type: "object",
        properties: {
            userId: {
                type: "number",
                description: "The ID of the user",
            },
        },
        required: ["userId"],
    }
  },
  {
    name: "find_user_by_name",
    description: "Find a user by their full name",
    input_schema: {
        type: "object",
        properties: {
            name: {
                type: "string",
                description: "The full name of the user",
            },
        },
        required: ["name"]
    }
  },
  {
    name: "get_posts_for_user",
    description: "Get post belonging to a user by their user ID",
    input_schema: {
        type: "object",
        properties: {
            userId: {
                type: "number",
                description: "The ID of the user"
            },
            limit: {
                type: "number",
                description: "Maximum number of posts to return"
            }
        },

        required: ["userId"],
    }

  }

];




// ============================================================
// TOOL REGISTRY
// Connect Claude's tool names to our JavaScript functions.
// ============================================================

const toolHandlers = {
  get_project_status: getProjectStatus,
  get_project_owner: getProjectOwner,
  get_user: getUser, 
  find_user_by_name: findUserByName,
  get_posts_for_user: getPostsForUser,
};





// ============================================================
// CONVERSATION
// ============================================================

const messages = [
  {
    role: "user",
    content: "Find the user named Leanne Graham and tell me the titles of 500 of her posts.",
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

    const toolResults = await executeToolRequests(
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
  if (message.stop_reason === "max_tokens") {
        console.log("Claude reached the maximum output token limit.")
        break;
    }
}