const LANGUAGE_MAP: Record<string, string> = {
    zh: "简体中文",
    ja: "日本語",
    en: "English"
};

const STRICT_FORMAT_NOTE_ZH = `
必须严格返回以下示例结构的纯文本 JSON 对象，不得在 JSON 前后包含任何说明文字，不得用 Markdown 代码块包裹。

输出格式示例（请严格遵守，包括字段名拼写）：
{
  "running": {
    "original_text": "running",
    "canonical_form": "run",
    "explanation": "（基于语境的释义）"
  },
  "went": {
    "original_text": "went",
    "canonical_form": "go",
    "explanation": "（基于语境的释义）"
  }
}

格式规则：
- 顶层键名必须与【目标词汇列表】中的词完全一致（大小写相同）
- original_text 必须与顶层键名完全一致
- canonical_form 必须是该词在词典中的原形（lemma），如 "ran" → "run"，"better" → "good"，"companies" → "company"
- explanation 必须使用目标语言输出，面向语言学习者，简明易懂
- 只解释目标词汇列表中的词，不得添加额外词条
- 输出中不得包含任何 JSON 之外的文字
`;

const STRICT_FORMAT_NOTE_JA = `
以下の形式の純粋なJSONオブジェクトのみを返してください。JSONの前後に説明文を含めず、Markdownのコードブロックでラップしないでください。

出力フォーマット例（フィールド名のスペルを厳守してください）：
{
  "running": {
    "original_text": "running",
    "canonical_form": "run",
    "explanation": "（文脈に基づく解説）"
  },
  "went": {
    "original_text": "went",
    "canonical_form": "go",
    "explanation": "（文脈に基づく解説）"
  }
}

フォーマットルール：
- トップレベルのキーは【説明すべき単語リスト】の単語と完全に一致させること（大文字・小文字も同じ）
- original_text はトップレベルのキーと完全に一致させること
- canonical_form は辞書の見出し語（lemma）にすること（例："ran" → "run"、"better" → "good"）
- explanation は対象言語で書き、言語学習者向けに簡潔で分かりやすくすること
- 説明すべき単語リストにある単語のみを説明し、余分な単語を追加しないこと
- JSON以外のテキストを出力に含めないこと
`;

const STRICT_FORMAT_NOTE_EN = `
Return ONLY a raw JSON object. Do not include any text before or after the JSON. Do not wrap it in a Markdown code block.

Output format example (follow the field names exactly):
{
  "running": {
    "original_text": "running",
    "canonical_form": "run",
    "explanation": "(context-based definition)"
  },
  "went": {
    "original_text": "went",
    "canonical_form": "go",
    "explanation": "(context-based definition)"
  }
}

Format rules:
- Top-level keys must match the MUST-EXPLAIN words exactly (case-sensitive)
- original_text must be identical to its top-level key
- canonical_form must be the dictionary lemma (e.g. "ran" → "run", "better" → "good")
- explanation must be written in the target language, concise and learner-friendly
- Only explain words in the MUST-EXPLAIN list — do not add extra entries
- Output must contain nothing other than the JSON object
`;

export function getExplainDictationPrompt(locale: string = "zh"): string {
    const isChinese = locale.startsWith("zh");
    const isJapanese = locale.startsWith("ja");
    const targetLanguage = LANGUAGE_MAP[locale] || LANGUAGE_MAP["zh"];

    if (isChinese) {
        return `你是一位专业的语言学习助手。
我将为你提供一段 Markdown 文本作为【语境上下文】，并在下面列出用户需要学习的【目标词汇列表】。

你的任务：
1. 遍历【目标词汇列表】中的每一项，并严格根据其在文本中的具体使用语境，提供高度准确的词典解释。
2. 提取该词的"标准词根（Canonical Form）"或原形（例如：如果目标词汇是 "ran"，它的标准词根就是 "run"）。
3. 你的解释必须强制使用 ${targetLanguage} 输出。确保解释内容易于语言学习者理解。
4. 必要时结合前后词组或整句话来解释。
${STRICT_FORMAT_NOTE_ZH}
--- 语境上下文 ---
{{text}}

--- 目标词汇列表 ---
{{words}}
`;
    }

    if (isJapanese) {
        return `あなたはプロの言語学習アシスタントです。
以下に【文脈テキスト】としてMarkdownテキストを提供し、その下にユーザーが学習したい【説明すべき単語リスト】を示します。

あなたのタスク：
1. 【説明すべき単語リスト】の各単語について、テキスト内での具体的な使用文脈に基づいて、高精度の辞書的解説を提供してください。
2. その単語の「標準見出し語（Canonical Form）」または原形を抽出してください（例："ran" の標準見出し語は "run"）。
3. 解説は必ず ${targetLanguage} で記述してください。言語学習者が理解しやすい内容にしてください。
4. 必要に応じて、前後の語句や文全体を考慮して解説してください。
${STRICT_FORMAT_NOTE_JA}
--- 文脈テキスト ---
{{text}}

--- 説明すべき単語リスト ---
{{words}}
`;
    }

    // English / fallback
    return `You are an expert language learning assistant.
I will provide you with a Markdown text as CONTEXT, and a LIST of words/phrases that the user wants to learn.

Your task:
1. For every word in the MUST-EXPLAIN list, provide a highly accurate dictionary definition based STRICTLY on how it is used in the provided text context.
2. Extract its "Canonical Form" / Lemma / Root (e.g., if the word is "ran", the canonical form is "run").
3. Your explanations MUST be written in ${targetLanguage}. Ensure the definition is easy to understand for language learners.
4. When needed, consider surrounding phrases or the full sentence for context.
${STRICT_FORMAT_NOTE_EN}
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
- Return valid JSON only — no text before or after the array`;
