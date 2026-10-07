export async function getPostsForUser({ 
    userId, 
    limit = 10, 
    page = 1
}) {

    if (
        limit <= 0
        || !Number.isInteger(limit)
        || typeof limit !== "number"
    ) {
        throw new Error("Limit must be a positive integer.");
    }
    
    if (
        typeof page !== "number"
        || !Number.isInteger(page)
        || page <=0 

    ){
        throw new Error("Page is not a valid number. It must be a positive integer.");
    }

    const MAX_POSTS = 3; 
    const safeLimit = Math.min(limit, MAX_POSTS)
    const offset = (page -1) * safeLimit;

    const response = await fetch(
        `https://jsonplaceholder.typicode.com/posts?userId=${userId}&_start=${offset}&_limit=${safeLimit}`,
    );

    if(!response.ok){
        throw new Error(
            ` Failed to get post for user ${userId}. HTTP status: ${response.status} ${response.statusText}`
        );
    }

    const totalPosts = Number(response.headers.get("x-total-count"));
    const posts = await response.json();
    const totalPages = Math.ceil(totalPosts / safeLimit);

    const postSummaries = 
    posts.slice(0, safeLimit)
    .map((post)=>({
        id: post.id,
        title: post.title,
        
    }))

    return {
        totalPosts,
        returnedPosts: postSummaries.length,
        page,
        totalPages,
        posts: postSummaries,
        
    }

}

export async function getPostCountForUser({ userId }) {
    const response = await fetch(
        `https://jsonplaceholder.typicode.com/posts?userId=${userId}&_limit=1`,
    )

    if(!response.ok) {
        throw new Error(
            `Failed to get post count for user ${userId}. HTTP status: ${response.status} ${response.statusText}`
        )
    }

    const totalPosts = Number(response.headers.get("x-total-count"));

    return {
        userId: userId,
        totalPosts: totalPosts,
    }


}

