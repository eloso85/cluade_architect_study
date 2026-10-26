function isRetryableError(error) {
    return (
        error.status === 429 ||
        error.status === 500 ||
        error.status === 502 ||
        error.status === 503 ||
        error.status === 504
    );
}

export async function withRetry(operation, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            console.log(
                `Attempt ${attempt} failed: ${error.message}`
            );

            if(!isRetryableError(error)) {
                throw error
            }

            if (attempt === maxAttempts) {
                throw error;
            }
        }
    }
}

