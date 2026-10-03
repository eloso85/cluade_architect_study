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

    const MAX_POSTS = 10; 
    const safeLimit = Math.min(limit, MAX_POSTS)

    const postSummaries = 
    posts.slice(0, safeLimit)
    .map((post)=>({
        id: post.id,
        title: post.title,
        
    }))

    return postSummaries;

}