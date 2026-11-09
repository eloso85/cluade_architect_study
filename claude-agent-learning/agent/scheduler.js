export function getReadyTasks(
    tasks,
    completedTasks,
    failedTasks = new Set()
) {
    const readyTasks = tasks.filter(task => {
        const notCompleted = !completedTasks.has(task.id)
        const notFailed = !failedTasks.has(task.id)
        
        const dependenciesCompleted = task.dependencies.every(
            dependency => completedTasks.has(dependency)
        );

        return notCompleted && notFailed && dependenciesCompleted;

    })

    return readyTasks;
}