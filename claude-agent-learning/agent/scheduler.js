export function getReadyTasks(tasks, completedTasks) {
    const readyTasks = tasks.filter(task => {
        const notCompleted = !completedTasks.has(task.id)

        const dependenciesCompleted = task.dependencies.every(
            dependency => completedTasks.has(dependency)
        );

        return notCompleted && dependenciesCompleted;

    })

    return readyTasks;
}