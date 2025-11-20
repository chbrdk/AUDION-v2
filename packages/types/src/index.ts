export * from './events';

export type PersonaProfile = {
  id: string;
  name: string;
  segment: string;
  headline: string;
  bio: string;
  traits: Record<string, number>;
  pain_points: Array<{ label: string; evidence_count: number }>;
  goals: Array<{ label: string; priority: number }>;
  communication_style: {
    vocabulary: string[];
    sentence_structure: string;
    skepticism_level: number;
  };
  confidence: number;
  version: string;
  created_at: string;
};

export type PersonaPrompt = {
  persona_id: string;
  system_prompt: string;
  template_version: string;
};

export type UploadJobStatus =
  | { status: 'processing'; progress: number }
  | { status: 'completed'; document_id: string }
  | { status: 'failed'; reason: string };

