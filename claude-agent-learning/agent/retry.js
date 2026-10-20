export async function withRetry(operation, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            console.log(
                `Attempt ${attempt} failed: ${error.message}`
            );

            if (attempt === maxAttempts) {
                throw error;
            }
        }
    }
}