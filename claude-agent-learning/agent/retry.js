function isRetryableError(error) {
    return (
        error.status === 429 ||
        error.status === 500 ||
        error.status === 502 ||
        error.status === 503 ||
        error.status === 504
    );
}

function sleep(ms){
    return new Promise((resolve) => setTimeout(resolve, ms));
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

            const delay = 1000 * 2 ** (attempt - 1)
            console.log(`Waiting ${delay}ms before retrying...`)
            await sleep(delay)
        }
    }
}

let testAttempt = 0;

const fakeOperation = async () => {
    testAttempt++;

    console.log(`Running operation ${testAttempt}`);

    if (testAttempt < 3) {
        const error = new Error("Service unavailable");
        error.status = 503;
        throw error;
    }

    return "Success!";
};

const result = await withRetry(fakeOperation);

console.log("Final result:", result);


