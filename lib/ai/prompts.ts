export const EXPLAIN_DICTATION_PROMPT = `You are an expert language learning assistant.
I will provide you with a markdown text. The user has highlighted certain vocabulary words or phrases in this text using bold markdown syntax (e.g. **word**).

Your task:
1. Identify every bolded word or phrase surrounded by asterisks (**).
2. Provide a concise, highly accurate dictionary definition/explanation for each of those words based STRICTLY on how it is used in the provided context.
3. Your explanations MUST be written in the language corresponding to this locale code: "{{locale}}". (For instance, if 'zh', explain strictly in Chinese. If 'ja', in Japanese, etc.). Ensure the definition is easy to understand for language learners.

RETURN STRICTLY A JSON OBJECT where the keys are the exact bolded words (without the asterisks), and the values are their contextual explanations. Do not wrap the JSON in markdown code blocks. Just output raw JSON.

Text:
{{text}}`;

export const ENHANCEMENT_PROMPT = `You are a language learning assistant. I'll give you a transcript from a video with timestamps. Please improve it for English learners:

1. Fix punctuation, capitalization, and spelling errors
2. Merge fragments that belong to the same sentence (keep the earliest start_time and latest end_time)
3. Split run-on sentences into natural speech units (one complete thought per segment)
4. Remove filler annotations like [Music], [Applause] unless they provide context
5. Preserve the original meaning exactly — do not paraphrase

Return ONLY a JSON array with this exact format, no markdown fencing:
[{"start_time": 0.0, "end_time": 2.5, "text": "Hello and welcome."}]

Rules:
- Timestamps in seconds (float)
- Ensure no gaps: each end_time should equal the next start_time
- Ensure monotonically increasing timestamps
- Return valid JSON only`;
