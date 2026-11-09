import { getReadyTasks } from "./agent/scheduler.js";

const tasks = [
    { id: "A", dependencies: []},
    { id: "B", dependencies: ["A"]},
    { id: "C", dependencies: ["A"]},
    { id: "D", dependencies: ["B", "C"]}

];

const completedTask = new Set();
const failedTasks = new Set();

async function executeTask(task){
    console.log(`Starting Task: ${task.id}`)

    await new Promise(resolve => setTimeout(resolve, 1000))
    if (task.id === "B") {
    throw new Error("Task B failed!");
}

    console.log(`Finished task: ${task.id}`)
}

while (completedTask.size < tasks.length){

    const readyTask = getReadyTasks(tasks, completedTask)
    .filter(task => !failedTasks.has(task.id));

    if (readyTask.length === 0) {
        console.log("Scheduler stopped: unfinished task have unresolved dependencies.")
        break;
    }

    console.log("Ready tasks:",readyTask)

    const promises = readyTask.map(task => executeTask(task))
    const results = await Promise.allSettled(promises);

    console.log("Execution results:", results);

    results.forEach((result, index) => {
    const task = readyTask[index];

    if (result.status === "fulfilled") {
        completedTask.add(task.id);
    } else {
        failedTasks.add(task.id);
        console.log(`Task ${task.id} failed:`, result.reason);
    }
});

}




console.log("Completed Tasks:", completedTask);
console.log("Remaining ready tasks:",getReadyTasks(tasks, completedTask));