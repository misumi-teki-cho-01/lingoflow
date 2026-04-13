const LANGUAGE_MAP: Record<string, string> = {
    zh: "简体中文",
    ja: "日语",
    en: "English"
};

export function getExplainDictationPrompt(locale: string = "zh"): string {
    const isChinese = locale.startsWith("zh");
    const targetLanguage = LANGUAGE_MAP[locale] || "简体中文";

    if (isChinese) {
        return `你是一位专业的语言学习助手。
我将为你提供一段 Markdown 文本作为【语境上下文】，并在下面列出用户需要学习的【目标词汇列表】。

你的任务：
1. 遍历【目标词汇列表】中的每一项，并严格根据其在文本中的具体使用语境，提供高度准确的词典解释。
2. 提取该词的“标准词根（Canonical Form）”或原形（例如：如果目标词汇是 "ran"，它的标准词根就是 "run"）。
3. 你的解释必须强制使用 ${targetLanguage} 输出。确保解释内容易于语言学习者理解。
4. 必要时结合前后词组或整句话来解释。

请严格返回以下格式的 JSON 对象，且外层键名及其内部的 original_text 必须与传入的目标词汇完全一致：
{
  "Word": {
    "original_text": "Word",
    "canonical_form": "word_lemma",
    "explanation": "基于语境的简明解释"
  }
}

不要用 Markdown 代码块包裹，只输出纯文本的原始 JSON。

--- 语境上下文 ---
{{text}}

--- 目标词汇列表 ---
{{words}}
`;
    }

    // Fallback / Other Languages
    return `You are an expert language learning assistant.
I will provide you with a markdown text to serve as CONTEXT, and a LIST of explicit words/phrases that the user wants to learn.

Your task:
1. For every MUST-EXPLAIN word in the provided list, provide a highly accurate dictionary definition/explanation based STRICTLY on how it is used in the provided text context.
2. Extract its "Canonical Form" / Lemma / Root (e.g., if the MUST-EXPLAIN word is "ran", the canonical form is "run").
3. Your explanations MUST be written in ${targetLanguage}. Ensure the definition is easy to understand for language learners.
4. You MUST ONLY explain the words in the MUST-EXPLAIN list.

RETURN STRICTLY A JSON OBJECT matching exactly this structure, where the top-level keys are EXACTLY the words from the MUST-EXPLAIN list:
{
  "Word": {
    "original_text": "Word",
    "canonical_form": "word_lemma",
    "explanation": "concise definition here"
  }
}

Do not wrap the JSON in markdown code blocks. Just output raw JSON.

--- Context Text ---
{{text}}

--- MUST-EXPLAIN Words ---
{{words}}
`;
}

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
