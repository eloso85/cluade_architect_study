import { getReadyTasks } from "./scheduler.js";
import { executeToolRequests } from "./executeTools.js";

export async function runWorkflow(workflow, toolHandlers){
    const completedTasks = new Set()
    const failedTasks = new Set()
    const taskResults = new Map()

    while (completedTasks.size + failedTasks.size < workflow.length){
        const readyTask = getReadyTasks(
            workflow,
            completedTasks,
            failedTasks
        );

        if (readyTask.length === 0) {
            console.log("Workflow stopped: no excutables task remains")
            break;
        }

        console.log(
            "Ready Tasks:",
            readyTask.map(task=> task.id)
        )

        const toolRequests = readyTask.map(task => ({
            id: task.id,
            name: task.name,
            input: task.input
        }));

        const toolResults = await executeToolRequests(
            toolRequests,
            toolHandlers
        )

        console.log("Workflow tool results:", toolResults)

        for (const result of toolResults) {
            const taskId = result.tool_use_id;

            if (result.is_error === true) {
                failedTasks.add(taskId);
                continue;
            }

            if (result.type === "approval_required") {
                throw new Error(
                    `Task ${taskId} requires human approval`
                );
            }

            const output = JSON.parse(result.content);

            taskResults.set(taskId, output);
            completedTasks.add(taskId);

        }


        break;
    }

    console.log("Completed Tasks:", completedTasks);
    console.log("Failed Tasks:", failedTasks);
    console.log("Task Results:", taskResults);

    return{
        completedTasks,
        failedTasks,
        taskResults
    }


}