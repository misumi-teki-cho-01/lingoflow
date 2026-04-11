export type AnnotationType = 'highlight' | 'bookmark' | 'note';

export interface Annotation {
  id: string;
  userId: string;
  transcriptId: string;
  segmentIndex: number;
  startChar?: number;
  endChar?: number;
  annotationType: AnnotationType;
  noteText?: string;
  color: string;
  createdAt: string;
}

export interface AIExplanation {
  id: string;
  annotationId: string;
  selectedText: string;
  explanation: ExplanationContent;
  model: string;
  createdAt: string;
}

export interface ExplanationContent {
  vocabulary?: VocabularyEntry[];
  grammar?: GrammarEntry[];
  context?: ContextEntry;
  translation?: string;
}

export interface VocabularyEntry {
  word: string;
  partOfSpeech: string;
  definition: string;
  pronunciation?: string;
  examples: string[];
}

export interface GrammarEntry {
  pattern: string;
  explanation: string;
  examples: string[];
}

export interface ContextEntry {
  meaning: string;
  register: string;
  culturalNotes?: string;
}
