import { workflow } from "./agent/workflow.js";
import { runWorkflow } from "./agent/workflowRunner.js";
import { findUserByName } from "./tools/userTools.js";

const toolHandlers = {
    find_user_by_name: {
        handler: findUserByName,
        operationType: "read"
    }
};

await runWorkflow(workflow, toolHandlers);