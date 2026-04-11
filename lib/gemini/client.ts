import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Encapsulated AI Generation Call.
 * Add models here as needed (defaulting to the highly capable gemini-2.0-flash).
 */
export async function generateText(prompt: string, modelType: string = "gemini-2.0-flash"): Promise<string> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: modelType });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
