export async function getPostsForUser({ userId, limit = 10 }) {
    const response = await fetch(
        `https://jsonplaceholder.typicode.com/posts?userId=${userId}`,
    );

    if(!response.ok){
        throw new Error(
            ` Failed to get post for user ${userId}. HTTP status: ${response.status} ${response.statusText}`
        );
    }

    const posts = await response.json();

    const postSummaries = 
    posts.slice(0, limit)
    .map((post)=>({
        id: post.id,
        title: post.title,
        
    }))

    return postSummaries;

}