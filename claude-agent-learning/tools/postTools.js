export async function getPostsForUser({ userId, limit = 10 }) {
     const MAX_POSTS = 3; 
    const safeLimit = Math.min(limit, MAX_POSTS)
    const response = await fetch(
        `https://jsonplaceholder.typicode.com/posts?userId=${userId}&_limit=${safeLimit}`,
    );
    //console.log("Response headers:", Object.fromEntries(response.headers));

    const totalPosts = Number(response.headers.get("x-total-count"));

    if(!response.ok){
        throw new Error(
            ` Failed to get post for user ${userId}. HTTP status: ${response.status} ${response.statusText}`
        );
    }

    const posts = await response.json();

   

    const postSummaries = 
    posts.slice(0, safeLimit)
    .map((post)=>({
        id: post.id,
        title: post.title,
        
    }))

    return {
        totalPosts,
        returnedPosts: postSummaries.length,
        posts: postSummaries,
    }

}