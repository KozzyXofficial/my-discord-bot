import Anthropic from "@anthropic-ai/sdk";

let client;

function getClient() {
    if (!client) {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error("Missing ANTHROPIC_API_KEY in .env");
        }
        client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return client;
}

export async function askClaude(prompt, modelName = "claude-haiku-4-5") {
    try {
        const anthropic = getClient();
        const response = await anthropic.messages.create({
            model: modelName,
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
        });
        return response.content[0].text;
    } catch (error) {
        console.error("Claude API Error:", error.status, error.message);

        if (error instanceof Anthropic.RateLimitError) {
            return "QUOTA_EXCEEDED";
        }

        if (error instanceof Anthropic.InternalServerError && error.status === 529) {
            return "QUOTA_EXCEEDED";
        }

        return "ERROR";
    }
}
