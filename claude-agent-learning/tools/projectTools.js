export async function getProjectStatus({ projectId }){
    await new Promise((resolve)=> setTimeout(resolve, 2000));
    return {
        id: projectId,
        status: "Behind Schedule",
        owner: "Sarah",
    }
}

export async function getProjectOwner({ projectId }) {
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate async operation
return {
    projectId,
    owner: "Sarah",
    email: "sarah@example.com",
  };
}