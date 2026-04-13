import { getDbAccess } from "@/lib/supabase/access";
import type { VocabularyExplanation } from "@/lib/ai/services";

export async function getSavedVocabularyForTranscript(
  transcriptId: string
): Promise<Record<string, VocabularyExplanation>> {
  const access = await getDbAccess();
  if (!access?.userId) return {};

  const { db, userId } = access;
  const { data, error } = await db
    .from("user_annotations")
    .select("selected_text, user_vocabulary!inner(canonical_form, explanation)")
    .eq("user_id", userId)
    .eq("transcript_id", transcriptId)
    .not("vocabulary_id", "is", null);

  if (error || !data) {
    console.error("[DB: Vocabulary] Failed to fetch saved vocabulary:", error);
    return {};
  }

  const definitions: Record<string, VocabularyExplanation> = {};
  for (const row of data) {
    const vocab = Array.isArray(row.user_vocabulary)
      ? row.user_vocabulary[0]
      : row.user_vocabulary;

    if (!vocab || !row.selected_text) continue;

    definitions[row.selected_text] = {
      original_text: row.selected_text,
      canonical_form: vocab.canonical_form,
      explanation: vocab.explanation,
    };
  }

  return definitions;
}

/**
 * Saves the vocabulary definitions extracted by the AI and links them to the transcript as user_annotations.
 */
export async function saveVocabularyAndAnnotations(
  videoExtId: string,
  definitions: Record<string, VocabularyExplanation>
) {
  const definitionEntries = Object.values(definitions);
  if (definitionEntries.length === 0) return;

  try {
    const access = await getDbAccess();
    if (!access?.userId) {
      console.warn(
        "[DB: Vocabulary] Skipping save because there is no authenticated user. " +
        "Set DEV_SUPABASE_USER_ID and SUPABASE_SERVICE_ROLE_KEY for development-only persistence."
      );
      return;
    }
    const { db, userId: activeUserId } = access;

    // 1. Get internal transcript_id from videoExtId
    const { data: transcriptInfo, error: tpError } = await db
      .from("videos")
      .select("id, transcripts(id)")
      .eq("video_ext_id", videoExtId)
      .single();

    if (tpError || !transcriptInfo || !transcriptInfo.transcripts || transcriptInfo.transcripts.length === 0) {
      console.warn("[DB: Vocabulary] Could not find transcript for video:", videoExtId);
      return;
    }

    const transcriptId = transcriptInfo.transcripts[0].id;

    // 2. Insert or update the canonical vocabulary
    // Deduplicate canonical forms within one request so Postgres upsert
    // does not see multiple rows targeting the same unique constraint.
    const vocabMap = new Map<string, { user_id: string; canonical_form: string; explanation: string }>();
    for (const def of definitionEntries) {
      const canonicalForm = def.canonical_form.trim();
      if (!canonicalForm) continue;

      vocabMap.set(canonicalForm, {
        user_id: activeUserId,
        canonical_form: canonicalForm,
        explanation: def.explanation,
      });
    }

    const vocabInserts = Array.from(vocabMap.values());
    if (vocabInserts.length === 0) return;

    const { data: vocabResult, error: vocabErr } = await db
      .from("user_vocabulary")
      .upsert(vocabInserts, { onConflict: "user_id,canonical_form", ignoreDuplicates: false })
      .select("id, canonical_form");

    if (vocabErr || !vocabResult) {
      console.error("[DB: Vocabulary] Failed to upsert vocabulary:", vocabErr);
      return;
    }

    // 3. Create annotations mapping the highlighted words to the transcript and the vocabulary
    const vocabIdByCanonicalForm = new Map(
      vocabResult.map(v => [v.canonical_form, v.id])
    );

    const annotationInserts = definitionEntries.map(def => ({
      user_id: activeUserId,
      transcript_id: transcriptId,
      vocabulary_id: vocabIdByCanonicalForm.get(def.canonical_form.trim()) ?? null,
      selected_text: def.original_text,
      annotation_type: "note", // default type
    }));

    const { error: annoErr } = await db
      .from("user_annotations")
      .insert(annotationInserts);

    if (annoErr) {
      console.error("[DB: Annotations] Failed to insert linked annotations:", annoErr);
    }
  } catch (error) {
    console.error("[DB: Vocabulary Flow] Unexpected error:", error);
  }
}
