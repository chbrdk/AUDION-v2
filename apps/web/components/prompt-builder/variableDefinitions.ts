/**
 * Variable definitions for the prompt builder
 */

export type VariableCategory = "journey" | "phase" | "persona" | "control" | "extended";

export interface VariableDefinition {
  name: string;
  syntax: string; // e.g., "${journey_name}" or "${persona:${persona_id}.name}"
  description: string;
  category: VariableCategory;
  example?: string;
  requiresContext?: string[]; // e.g., ["persona_id"] for extended vars
}

export const STANDARD_VARIABLES: VariableDefinition[] = [
  // Journey Variables
  {
    name: "journey_name",
    syntax: "${journey_name}",
    description: "Name of the journey",
    category: "journey",
    example: "E-Bike Kauf Journey",
  },
  {
    name: "journey_type",
    syntax: "${journey_type}",
    description: "Type of the journey (e.g., purchase, support, onboarding)",
    category: "journey",
    example: "purchase",
  },
  {
    name: "journey_description",
    syntax: "${journey_description}",
    description: "Full description of the journey",
    category: "journey",
    example: "Complete journey from awareness to purchase",
  },
  {
    name: "target_group_summary",
    syntax: "${target_group_summary}",
    description: "Summary of the target group characteristics",
    category: "journey",
    example: "Tech-savvy urban professionals, 30-45 years",
  },
  {
    name: "persona_summaries",
    syntax: "${persona_summaries}",
    description: "Summarized information about related personas",
    category: "journey",
    example: "Persona 1: Tech Enthusiast, Persona 2: Eco-Conscious...",
  },

  // Phase Variables
  {
    name: "phase_name",
    syntax: "${phase_name}",
    description: "Name of the current phase",
    category: "phase",
    example: "Awareness",
  },
  {
    name: "phase_description",
    syntax: "${phase_description}",
    description: "Description of the current phase",
    category: "phase",
    example: "Customer becomes aware of the product",
  },
  {
    name: "phase_expected_emotion",
    syntax: "${phase_expected_emotion}",
    description: "Expected emotion for the phase",
    category: "phase",
    example: "hopeful, anxious, frustrated",
  },
  {
    name: "existing_phases_summary",
    syntax: "${existing_phases_summary}",
    description: "Summary of all existing phases in the journey",
    category: "phase",
    example: "Phase 1: Awareness, Phase 2: Consideration...",
  },
  {
    name: "existing_phases_count",
    syntax: "${existing_phases_count}",
    description: "Number of existing phases",
    category: "phase",
    example: "3",
  },
  {
    name: "last_phase_summary",
    syntax: "${last_phase_summary}",
    description: "Detailed summary of the last phase",
    category: "phase",
    example: "Phase 3: Purchase - Customer completes order...",
  },
  {
    name: "last_phase_name",
    syntax: "${last_phase_name}",
    description: "Name of the last phase",
    category: "phase",
    example: "Purchase",
  },
  {
    name: "last_phase_emotion",
    syntax: "${last_phase_emotion}",
    description: "Emotion of the last phase",
    category: "phase",
    example: "satisfied",
  },
  {
    name: "next_phase_number",
    syntax: "${next_phase_number}",
    description: "Number of the next phase to be created",
    category: "phase",
    example: "4",
  },

  // Persona Variables
  {
    name: "persona_name",
    syntax: "${persona_name}",
    description: "Name of the persona",
    category: "persona",
    example: "Tech Enthusiast",
  },
  {
    name: "persona_headline",
    syntax: "${persona_headline}",
    description: "Headline or tagline of the persona",
    category: "persona",
    example: "Early adopter of new technologies",
  },
  {
    name: "persona_bio",
    syntax: "${persona_bio}",
    description: "Full biography or description of the persona",
    category: "persona",
    example: "Detailed persona profile with demographics, goals, challenges...",
  },
  {
    name: "persona_profile",
    syntax: "${persona_profile}",
    description: "Full profile of the persona",
    category: "persona",
    example: "Age, occupation, goals, challenges...",
  },
  {
    name: "persona_pain_points",
    syntax: "${persona_pain_points}",
    description: "Existing pain points of the persona",
    category: "persona",
    example: "Lack of time, budget constraints...",
  },
  {
    name: "existing_traits",
    syntax: "${existing_traits}",
    description: "List of currently defined personality traits",
    category: "persona",
    example: "organizer, tech-savvy, detail-oriented",
  },
  {
    name: "graph_relationships_summary",
    syntax: "${graph_relationships_summary}",
    description: "Formatted summary of Neo4j knowledge graph relationships",
    category: "persona",
    example: "HAS_INTEREST: [technology, innovation]",
  },
  {
    name: "knowledge_context",
    syntax: "${knowledge_context}",
    description: "Relevant research chunks from Qdrant vector database",
    category: "persona",
    example: "Research findings about user behavior...",
  },

  // Control Variables
  {
    name: "max_items",
    syntax: "${max_items}",
    description: "Maximum number of items to generate",
    category: "control",
    example: "5",
  },
  {
    name: "max_suggestions",
    syntax: "${max_suggestions}",
    description: "Maximum number of suggestions to return",
    category: "control",
    example: "3",
  },
];

export const EXTENDED_VARIABLES: VariableDefinition[] = [
  {
    name: "persona.name",
    syntax: "${persona:${persona_id}.name}",
    description: "Get persona name using persona_id from context",
    category: "extended",
    example: "Tech Enthusiast",
    requiresContext: ["persona_id"],
  },
  {
    name: "persona.profile.traits",
    syntax: "${persona:${persona_id}.profile.traits}",
    description: "Access persona profile traits using dot notation",
    category: "extended",
    example: '{"organizer": "high", "tech-savvy": "very-high"}',
    requiresContext: ["persona_id"],
  },
  {
    name: "journey.phases[0].name",
    syntax: "${journey:${journey_id}.phases[0].name}",
    description: "Get name of the first journey phase (index 0)",
    category: "extended",
    example: "Awareness",
    requiresContext: ["journey_id"],
  },
  {
    name: "journey.phases[*].name",
    syntax: "${journey:${journey_id}.phases[*].name}",
    description: "Get all phase names (returns newline-separated list)",
    category: "extended",
    example: "Awareness\nConsideration\nDecision",
    requiresContext: ["journey_id"],
  },
  {
    name: "journey.phases[2].expected_emotion",
    syntax: "${journey:${journey_id}.phases[2].expected_emotion}",
    description: "Get expected emotion of the third phase (index 2)",
    category: "extended",
    example: "satisfied",
    requiresContext: ["journey_id"],
  },
  {
    name: "phase.name",
    syntax: "${phase:${phase_id}.name}",
    description: "Get phase name using phase_id from context",
    category: "extended",
    example: "Awareness",
    requiresContext: ["phase_id"],
  },
  {
    name: "target_group.name",
    syntax: "${target_group:${target_group_id}.name}",
    description: "Get target group name using target_group_id from context",
    category: "extended",
    example: "Urban Tech Professionals",
    requiresContext: ["target_group_id"],
  },
  {
    name: "knowledge.search.content",
    syntax: "${knowledge:${query}.content}",
    description: "Search knowledge base and return content of top results (newline-separated)",
    category: "extended",
    example: "Research findings about user behavior...",
    requiresContext: ["query"],
  },
  {
    name: "knowledge.search.results",
    syntax: "${knowledge:${query}.results}",
    description: "Search knowledge base and return structured JSON results with content, document_id, score",
    category: "extended",
    example: '[{"content": "...", "document_id": "...", "score": 0.85}]',
    requiresContext: ["query"],
  },
  {
    name: "knowledge.target_group.content",
    syntax: "${knowledge:${target_group_id}.content}",
    description: "Get all knowledge chunks for a target group (newline-separated content)",
    category: "extended",
    example: "All research findings for this target group...",
    requiresContext: ["target_group_id"],
  },
];

export const getAllVariables = (): VariableDefinition[] => {
  return [...STANDARD_VARIABLES, ...EXTENDED_VARIABLES];
};

export const getVariablesByCategory = (category: VariableCategory): VariableDefinition[] => {
  return getAllVariables().filter((v) => v.category === category);
};

