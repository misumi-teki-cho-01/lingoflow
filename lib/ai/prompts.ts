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
- canonical_form 必须是该词在词典中的原形（lemma），如 "ran" → "run"，"better" → "good"，"companies" → "company"；若解释的是完整词组，填入词组的标准形式
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
- canonical_form は辞書の見出し語（lemma）にすること（例："ran" → "run"、"better" → "good"）；句動詞や熟語全体を説明する場合は、その標準形を記入
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
- canonical_form must be the dictionary lemma (e.g. "ran" → "run", "better" → "good"); if explaining a full phrase, use the phrase's canonical form
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

**重要提示**：【语境上下文】中，目标词汇已用 **粗体**（\`**...**\`）标注出来。请务必先在原文中找到该词被加粗标注的具体位置，再基于该位置所在句子的完整语境给出解释——而非仅凭词汇列表中的词形来猜测其语境。

你的任务：
1. 遍历【目标词汇列表】中的每一项，**在原文中定位其加粗出现的句子**，并严格根据该句的具体语境提供高度准确的解释。解释必须基于该词在原文中的特定含义，禁止给出脱离语境的通用词典释义。
2. 提取该词的"标准词根（Canonical Form）"或原形（例如：如果目标词汇是 "ran"，标准词根是 "run"）。
3. 你的解释必须强制使用 ${targetLanguage} 输出。确保解释内容易于语言学习者理解。
4. **词组识别**：若被标记的单个词语与其在原文中紧邻的词语共同构成固定搭配或短语（例如 *look forward to*、*run out of*、*as well as*、*make up for*），**应将整个短语作为解释单元**，把完整短语填入 \`original_text\`，并解释整个短语的含义，而非仅解释被标记的单个词语。
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

**重要**：【文脈テキスト】では、対象の語は **太字**（\`**...**\`）でマークされています。まずテキスト中でその語が太字になっている箇所を正確に特定し、その箇所の文の文脈に基づいて解説してください。単語リストの語形だけから文脈を推測しないでください。

あなたのタスク：
1. 【説明すべき単語リスト】の各単語について、**テキスト内で太字になっている箇所の文を特定し**、その文の具体的な文脈に基づいて高精度の解説を提供してください。解説は必ずその語のテキスト内での特定の意味に基づくこと。文脈を無視した汎用的な辞書の説明は禁止です。
2. その単語の「標準見出し語（Canonical Form）」または原形を抽出してください。
3. 解説は必ず ${targetLanguage} で記述してください。言語学習者が理解しやすい内容にしてください。
4. **句動詞・熟語の認識**：マークされた単語がテキスト内の前後の語と合わさって固定表現や句動詞を形成している場合（例：*look forward to*、*run out of*、*as well as*）、**フレーズ全体を説明単位とし**、フレーズ全体を \`original_text\` に記入して説明してください。
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

**Important**: In the CONTEXT, the target words are marked in **bold** (\`**...**\`). You must first locate each word at its exact bolded position in the text, then explain it based on the complete sentence context at that position — do NOT guess the context from the word list alone.

Your task:
1. For every word in the MUST-EXPLAIN list, **find its bolded occurrence in the context text** and provide a highly accurate definition based STRICTLY on the specific meaning in that sentence. The explanation must reflect the word's meaning in context — generic dictionary definitions that ignore context are not acceptable.
2. Extract its "Canonical Form" / Lemma / Root (e.g., if the word is "ran", the canonical form is "run").
3. Your explanations MUST be written in ${targetLanguage}. Ensure the definition is easy to understand for language learners.
4. **Phrase detection**: If a marked word, together with adjacent words in the original text, forms a fixed collocation or phrasal verb (e.g., *look forward to*, *run out of*, *as well as*, *make up for*), **treat the entire phrase as the unit of explanation**: put the full phrase in \`original_text\` and explain the phrase as a whole, not just the individual marked word.
${STRICT_FORMAT_NOTE_EN}
--- Context Text ---
{{text}}

--- MUST-EXPLAIN Words ---
{{words}}
`;
}

export function getEnhancementPrompt(locale: string = "zh"): string {
    const isChinese = locale.startsWith("zh");
    const isJapanese = locale.startsWith("ja");

    const FORMAT_RULE = `Return ONLY a JSON array with this exact format, no markdown fencing:
[{"start_time": 0.0, "end_time": 2.5, "text": "Hello and welcome."}]

Rules:
- Timestamps in seconds (float)
- Return valid JSON only — no text before or after the array`;

    if (isChinese) {
        return `你是一位专业的语言学习助手。我将提供一段带时间戳的视频字幕，请按以下要求进行优化：

1. 修正标点符号、大小写和拼写错误
2. 将属于同一句话的片段合并（取所有被合并片段中最小的 start_time 和最大的 end_time）
3. 不要拆分句子——合并操作保持保守
4. 删除 [Music]、[Applause] 等无意义的标注（除非有上下文意义）
5. 严格保留原意——不要意译或改写

时间戳规则：
- 直接从输入中复制 start_time 和 end_time——不要自行推算或修改
- 合并时使用被合并条目中最小的 start_time 和最大的 end_time
- 片段之间存在间隙是可以接受的——不要为了填补间隙而调整时间戳

${FORMAT_RULE}`;
    }

    if (isJapanese) {
        return `あなたはプロの言語学習アシスタントです。タイムスタンプ付きの動画字幕を提供します。以下の改善を行ってください：

1. 句読点・大文字/小文字・スペルミスを修正する
2. 同じ文に属するフラグメントを結合する（結合するフラグメントの中で最も小さい start_time と最も大きい end_time を使用する）
3. 文を分割しない——結合は控えめに行う
4. [Music]、[Applause] などの無意義なアノテーションを削除する（文脈上意味がある場合を除く）
5. 原文の意味を厳密に保持する——言い換えや意訳は禁止

タイムスタンプのルール：
- start_time と end_time は入力からそのままコピーする——値を推測・再計算しない
- 結合する場合は、結合対象の中で最も小さい start_time と最も大きい end_time を使用する
- セグメント間にギャップがあっても許容される——ギャップを埋めるためにタイムスタンプを調整しない

${FORMAT_RULE}`;
    }

    // English / fallback
    return `You are a language learning assistant. I'll give you a transcript from a video with timestamps. Please improve it for English learners:

1. Fix punctuation, capitalization, and spelling errors
2. Merge fragments that belong to the same sentence (use the earliest start_time and latest end_time of the merged fragments)
3. Do NOT split sentences — keep merging conservative
4. Remove filler annotations like [Music], [Applause] unless they provide context
5. Preserve the original meaning exactly — do not paraphrase

Timestamp rules:
- Copy start_time and end_time exactly from the input — do not invent or recalculate values
- When merging, use the smallest start_time and largest end_time among the merged items
- Gaps between segments are acceptable — do not adjust timestamps to fill gaps

${FORMAT_RULE}`;
}
