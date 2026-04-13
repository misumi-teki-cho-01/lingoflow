"use client";

import { useState, useCallback } from "react";
import type { VocabularyExplanation } from "@/lib/ai/services";

export interface SelectedWord {
  id: string;
  text: string;
}

export type ReviewStep = "review_words" | "prompt_editor" | "paste_json" | "review_ai";

export interface UseVocabularyReviewReturn {
  showReviewModal: boolean;
  selectedWords: SelectedWord[];
  reviewStep: ReviewStep;
  definitions: Record<string, VocabularyExplanation>;
  openReview: (words: SelectedWord[], step?: ReviewStep) => void;
  closeReview: () => void;
  setDefinitions: React.Dispatch<React.SetStateAction<Record<string, VocabularyExplanation>>>;
}

export function useVocabularyReview(
  initialDefinitions: Record<string, VocabularyExplanation> = {}
): UseVocabularyReviewReturn {
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedWords, setSelectedWords] = useState<SelectedWord[]>([]);
  const [reviewStep, setReviewStep] = useState<ReviewStep>("review_words");
  const [definitions, setDefinitions] = useState<Record<string, VocabularyExplanation>>(initialDefinitions);

  const openReview = useCallback((words: SelectedWord[], step: ReviewStep = "review_words") => {
    setSelectedWords(words);
    setReviewStep(step);
    setShowReviewModal(true);
  }, []);

  const closeReview = useCallback(() => {
    setShowReviewModal(false);
  }, []);

  return {
    showReviewModal,
    selectedWords,
    reviewStep,
    definitions,
    openReview,
    closeReview,
    setDefinitions,
  };
}
