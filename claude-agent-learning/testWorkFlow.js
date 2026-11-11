import { workflow } from "./agent/workflow.js";
import { runWorkflow } from "./agent/workflowRunner.js";
import { findUserByName } from "./tools/userTools.js";
import {
    getPostsForUser,
    getPostCountForUser,
    validateGetPostsForUserInput
} from "./tools/postTools.js"

const toolHandlers = {
    find_user_by_name: {
        handler: findUserByName,
        operationType: "read"
    },
    get_posts_for_user: {
        handler: getPostsForUser,
        validator: validateGetPostsForUserInput,
        operationType: "read"
    },
    get_post_count_for_user:{
        handler:getPostCountForUser,
        operationType: "read"
    }
};

await runWorkflow(workflow, toolHandlers);