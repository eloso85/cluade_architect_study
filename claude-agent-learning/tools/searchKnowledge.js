import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

const KNOWLEDGE_DIR = path.resolve('knowledge');

export async function searchKnowledge(query){
    const files = await readdir(KNOWLEDGE_DIR);

    const searchTerm = query.toLowerCase();

    const results = []

    for (const file of files) {
        if (!file.endsWith(".txt")){
            continue
        }

        const filePath = path.join(KNOWLEDGE_DIR, file);
        const content = await readFile(filePath, "utf-8");

        if (content.toLowerCase().includes(searchTerm)){
            results.push({
                source: file,
                content
            })
        }
    }

    return results
}