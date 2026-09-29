export async function getUser({ userId }){
    const response = await fetch(`
        https://jsonplaceholder.typicode.com/users/${userId}`
    );

    if(!response.ok) {
        throw new Error(`
            Failed to get user ${userId}. HTTP status: ${response.status} ${response.statusText}
            `)
    }
    
    const user = await response.json();

    return user;
}

export async function findUserByName({ name }) {
    const response = await fetch(
        `https://jsonplaceholder.typicode.com/users?name=${encodeURIComponent(name)}`,
    );

    if (!response.ok) {
        throw new Error(
            `Failed to find user ${name}. HTTP status ${response.status} ${response.statusText}`
        );
    }

    const users = await response.json();

    if (users.length === 0){
        throw new Error (` No user found with name: ${name}`)
    }

    return users[0];
}

