import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export function getGemini2_0FlashModel() {
  const client = getGeminiClient();
  return client.getGenerativeModel({ model: "gemini-2.0-flash" });
}

/**
 * Standard AI text generation using the default capable model (gemini-2.0-flash).
 * Add other methods with specific models if special requirements arise.
 */
export async function generateText(prompt: string | string[]): Promise<string> {
  const model = getGemini2_0FlashModel();

  const content = Array.isArray(prompt) ? prompt : [prompt];
  const result = await model.generateContent(content);

  return result.response.text();
}
