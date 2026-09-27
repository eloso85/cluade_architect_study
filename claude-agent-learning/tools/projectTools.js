export function getProjectStatus({ projectId }){
    return {
        id: projectId,
        status: "Behind Schedule",
        owner: "Sarah",
    }
}

export async function getProjectOwner({ projectId }) {
  await new Promise((resolve) => setTimeout(resolve, 5000)); // Simulate async operation
return {
    projectId,
    owner: "Sarah",
    email: "sarah@example.com",
  };
}