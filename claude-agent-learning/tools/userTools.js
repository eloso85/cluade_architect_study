export async function getUser({ userId }){
    const response = await fetch(`
        https://jsonplaceholder.typicode.com/users/${userId}`
    );
    
    const user = await response.json();

    return user;
}