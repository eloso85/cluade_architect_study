export async function getPostForUser({ name }) {
    const response = await fetch(
        `https://jsonplaceholder.typicode.com/posts?userId=${userId}`,
    );

    if(!response.ok){
        throw new Error(
            ` Failed to get post for user ${userId}. HTTP status: ${response.status} ${response.statusText}`
        );
    }

    const posts = await response.json();

    return posts;

}