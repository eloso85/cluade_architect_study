export function getProjectStatus({ projectId }){
    return {
        id: projectId,
        status: "Behind Schedule",
        owner: "Sarah",
    }
}

export function getProjectOwner({ projectId}) {
    return {
        id: projectId,
        owner: "Sarah",
        email: "sarah@example.com"
    }
}