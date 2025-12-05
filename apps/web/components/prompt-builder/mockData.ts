/**
 * Mock data generator for prompt testing when no real IDs are provided
 */

export const generateMockContext = (): Record<string, any> => ({
  // Journey variables
  journey_name: "E-Bike Purchase Journey",
  journey_type: "purchase",
  journey_description: "Complete customer journey from initial awareness to final purchase and onboarding",
  target_group_summary: "Tech-savvy urban professionals, aged 30-45, interested in sustainable transportation",
  persona_summaries: "Persona 1: Tech Enthusiast - Early adopter, values innovation. Persona 2: Eco-Conscious - Environmental advocate, sustainability-focused",

  // Phase variables
  phase_name: "Awareness",
  phase_description: "Customer becomes aware of the product through marketing channels and initial research",
  phase_expected_emotion: "curious",
  existing_phases_summary: "Phase 1: Awareness - Customer discovers product\nPhase 2: Consideration - Evaluates options\nPhase 3: Decision - Makes purchase decision",
  existing_phases_count: "3",
  last_phase_summary: "Phase 3: Decision - Customer completes order and receives confirmation",
  last_phase_name: "Decision",
  last_phase_emotion: "satisfied",
  next_phase_number: "4",

  // Persona variables
  persona_name: "Tech Enthusiast",
  persona_headline: "Early adopter of new technologies",
  persona_bio: "A tech-savvy professional in their mid-30s who loves trying new gadgets and innovative solutions. Values efficiency and cutting-edge technology.",
  persona_profile: "Age: 35, Occupation: Software Engineer, Location: Urban area, Income: High",
  persona_pain_points: "Lack of time, budget constraints, information overload",
  existing_traits: "organizer, tech-savvy, detail-oriented, early-adopter",
  graph_relationships_summary: "HAS_INTEREST: [technology, innovation], WORKS_WITH: [software, tools]",
  knowledge_context: "Research findings about tech-savvy consumers show preference for digital-first experiences and data-driven decision making.",

  // Control variables
  max_items: "5",
  max_suggestions: "3",
});

/**
 * Generate mock data for extended variables
 */
export const generateMockExtendedData = (): Record<string, any> => ({
  // Mock persona data structure
  persona: {
    name: "Tech Enthusiast",
    headline: "Early adopter of new technologies",
    profile: {
      traits: {
        organizer: "high",
        "tech-savvy": "very-high",
        "detail-oriented": "high",
        "early-adopter": "very-high",
      },
      goals: [
        { label: "Increase productivity" },
        { label: "Stay ahead of technology trends" },
        { label: "Optimize daily routines" },
      ],
      pain_points: [
        { label: "Information overload" },
        { label: "Time constraints" },
        { label: "Budget limitations" },
      ],
    },
  },

  // Mock journey data structure
  journey: {
    name: "E-Bike Purchase Journey",
    journey_type: "purchase",
    description: "Complete customer journey from initial awareness to final purchase",
    phases: [
      {
        id: "phase-1",
        name: "Awareness",
        description: "Customer becomes aware of the product",
        phase_order: 1,
        expected_emotion: "curious",
        expected_duration_min: 5,
        expected_duration_max: 15,
        duration_unit: "minutes",
      },
      {
        id: "phase-2",
        name: "Consideration",
        description: "Customer evaluates different options",
        phase_order: 2,
        expected_emotion: "analytical",
        expected_duration_min: 30,
        expected_duration_max: 120,
        duration_unit: "minutes",
      },
      {
        id: "phase-3",
        name: "Decision",
        description: "Customer makes purchase decision",
        phase_order: 3,
        expected_emotion: "satisfied",
        expected_duration_min: 10,
        expected_duration_max: 30,
        duration_unit: "minutes",
      },
    ],
  },

  // Mock target group data
  target_group: {
    name: "Urban Tech Professionals",
    segment: "tech-savvy-urban-professionals",
    personas: [
      { id: "persona-1", name: "Tech Enthusiast" },
      { id: "persona-2", name: "Eco-Conscious Professional" },
    ],
  },

  // Mock phase data
  phase: {
    id: "phase-1",
    name: "Awareness",
    description: "Customer becomes aware of the product through marketing channels",
    phase_order: 1,
    expected_emotion: "curious",
    emotion_intensity: 0.7,
    expected_duration_min: 5,
    expected_duration_max: 15,
    duration_unit: "minutes",
  },

  // Mock knowledge data
  knowledge: {
    "[query]": {
      content: "Mock research findings about the query topic. This includes relevant insights from user research studies, market analysis reports, and behavioral observations.\n\nAdditional context about user preferences and pain points related to the query.",
      results: [
        {
          content: "Mock chunk content 1: Research findings about user behavior patterns in tech adoption scenarios...",
          document_id: "doc-uuid-1",
          chunk_id: "chunk-uuid-1",
          score: 0.85,
        },
        {
          content: "Mock chunk content 2: Additional insights from qualitative interviews about user motivations...",
          document_id: "doc-uuid-2",
          chunk_id: "chunk-uuid-2",
          score: 0.78,
        },
        {
          content: "Mock chunk content 3: Quantitative data showing trends in user preferences...",
          document_id: "doc-uuid-3",
          chunk_id: "chunk-uuid-3",
          score: 0.72,
        },
      ],
    },
  },
});

/**
 * Resolve extended variable path from mock data
 */
export const resolveExtendedVariable = (
  resolverType: string,
  propertyPath: string,
  mockData: Record<string, any> = generateMockExtendedData(),
  queryOrId?: string
): string => {
  // Special handling for knowledge resolver
  if (resolverType === "knowledge") {
    const knowledgeData = mockData[resolverType];
    if (!knowledgeData) {
      return `[${resolverType} not found]`;
    }
    // Use "[query]" as default key or provided query/id
    const queryKey = queryOrId || "[query]";
    const entity = knowledgeData[queryKey] || knowledgeData["[query]"];
    if (!entity) {
      return `[Knowledge data not found for query: ${queryKey}]`;
    }
    
    // Navigate property path (e.g., .content or .results)
    const parts = propertyPath.split(".").filter(Boolean);
    let current: any = entity;
    
    for (const part of parts) {
      current = current?.[part];
      if (current === undefined) {
        return `[Knowledge property '${part}' not found]`;
      }
    }
    
    // Convert to string
    if (typeof current === "object") {
      return JSON.stringify(current, null, 2);
    }
    return String(current);
  }
  
  const entity = mockData[resolverType];
  if (!entity) {
    return `[${resolverType} not found]`;
  }

  // Navigate property path
  const parts = propertyPath.split(".").filter(Boolean);
  let current: any = entity;

  for (const part of parts) {
    // Handle array indexing: phases[0] or phases[*]
    const arrayMatch = part.match(/^([^\[]+)\[(\d+|\*)\]$/);
    if (arrayMatch) {
      const attrName = arrayMatch[1];
      const indexStr = arrayMatch[2];
      current = current[attrName];

      if (!Array.isArray(current)) {
        return `[${resolverType} property '${attrName}' is not an array]`;
      }

      if (indexStr === "*") {
        // Wildcard: return all items
        return current.map((item: any) => {
          // Continue navigation if there are more parts
          const remainingPath = parts.slice(parts.indexOf(part) + 1).join(".");
          if (remainingPath) {
            return navigatePath(item, remainingPath);
          }
          return JSON.stringify(item);
        }).join("\n");
      } else {
        const index = parseInt(indexStr, 10);
        if (index < 0 || index >= current.length) {
          return `[${resolverType} array index ${index} out of range]`;
        }
        current = current[index];
      }
    } else {
      current = current?.[part];
      if (current === undefined) {
        return `[${resolverType} property '${part}' not found]`;
      }
    }
  }

  // Convert to string
  if (typeof current === "object") {
    return JSON.stringify(current, null, 2);
  }
  return String(current);
};

/**
 * Navigate a property path on an object
 */
function navigatePath(obj: any, path: string): string {
  const parts = path.split(".").filter(Boolean);
  let current = obj;
  for (const part of parts) {
    current = current?.[part];
    if (current === undefined) {
      return `[Property '${part}' not found]`;
    }
  }
  if (typeof current === "object") {
    return JSON.stringify(current, null, 2);
  }
  return String(current);
}

