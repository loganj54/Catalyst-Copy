// ============================================================================
// GENERATE STRUCTURE EDGE FUNCTION (MONOLITHIC)
// ============================================================================
// Step 2 of the Pipeline: Transforms document analysis into a comprehensive
// learning structure with intelligent search queries for each topic/concept
//
// KEY FEATURES:
// - Accepts document analysis or any structured input
// - Generates 3-5 progressive search queries per topic
// - Organizes output by prerequisites and content sections
// - Stores results in blueprint_structures table for search-resources step
// - NOW USES SECTION-LEVEL CACHING (one row per section)
//
// INPUT: { blueprint_id } or { analysis: {...}, input_type: 'custom' }
// OUTPUT: Structured learning path with search queries
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  createSupabaseClient,
  createSupabaseClientWithAuth,
  callClaudeJSON,
} from '../_shared/supabase-client.ts';
import { PROMPTS } from '../_shared/prompts.ts';
import { generateEmbedding, generateEmbedding1536, formatVectorForPostgres } from '../_shared/embeddings.ts';
// NEW: Use section-level caching utilities
import {
  generateAllSectionEmbeddings,
  prepareSectionsForCache,
  storeSectionsInPinecone,
  querySimilarSectionsFromPinecone
} from '../_shared/section-embeddings.ts';
import {
  findOrCreateFigure,
} from '../_shared/figure-sourcing.ts';
import { upsertVectors } from '../_shared/pinecone-client.ts';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface GenerateStructureRequest {
  // Option 1: Reference a blueprint (will fetch its document_analysis)
  blueprint_id?: string;

  // Option 2: Direct input (for future flexibility)
  analysis?: any;
  input_type?: 'document_analysis' | 'custom';
}

// Search query generated for a topic
interface SearchQuery {
  query: string;
  query_type: 'introduction' | 'concept' | 'tutorial' | 'example' | 'practice';
  target_content: string;
  priority: number;
}

// Equation definition for LaTeX rendering
interface Equation {
  index: number;
  name: string;
  latex: string;
  variables: Record<string, string>;
  when_to_use: string;
}

// Suggested figure/diagram for a learning unit
interface SuggestedFigure {
  name: string;
  figure_type: 'diagram' | 'chart' | 'graph' | 'table' | 'illustration';
  description: string;
  search_terms: string[];
}

// Learning unit within a section
interface LearningUnit {
  unit_id: string;
  unit_type: 'prerequisite' | 'topic' | 'walkthrough'; // Type of learning unit
  topic: string;
  concept_summary?: string; // Short, punchy 10-15 word summary tagline
  description?: string;
  learning_objective?: string;
  tutor_guidance: string; // AI-generated tutor explanation (3-5 sentences) explaining WHY this topic matters and the approach
  category?: string;
  difficulty?: string;
  priority?: string;
  estimated_time_minutes: number;
  equations?: Equation[]; // LaTeX equations for this learning unit (when applicable)
  suggested_figures?: SuggestedFigure[]; // Suggested figures/diagrams for this unit
  search_queries: SearchQuery[]; // For videos (concept videos for topic units, problem walkthroughs for walkthrough units)
  problem_solving_queries?: SearchQuery[]; // DEPRECATED - now incorporated into walkthrough units
  semantic_search_phrase?: string; // Natural language description of the ideal video resource for semantic search
  target_resource_profile?: string; // Description of the ideal resource for this unit
  target_resource_embedding?: number[]; // Pre-computed embedding (1536 dimensions) of the target resource profile
}

// Prerequisite section structure
interface PrerequisitesSection {
  description: string;
  learning_units: LearningUnit[];
}

// Content section (problem or topic)
interface ContentSection {
  section_id: string;
  section_type: 'problem' | 'topic' | 'chapter';
  title: string;
  description: string;
  concepts: string[];
  learning_units: LearningUnit[];
  problem_details?: {
    original_problem_id: string;
    key_equations: string[];
    common_mistakes: string[];
  };
}

// Complete learning structure
interface LearningStructure {
  summary: {
    title: string;
    description: string;
    total_estimated_time_minutes: number;
    difficulty_progression: string;
  };
  prerequisites_section: PrerequisitesSection;
  content_sections: ContentSection[];
}

// Flattened search query for batch processing
interface FlatSearchQuery {
  unit_id: string;
  section_id: string;
  section_type: 'prerequisite' | 'content';
  topic: string;
  query: string;
  query_type: string;
  target_content: string;
  priority: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Flatten all search queries from the structure for easy batch processing
 */
function flattenSearchQueries(structure: LearningStructure): FlatSearchQuery[] {
  const queries: FlatSearchQuery[] = [];

  // Flatten prerequisite queries
  if (structure.prerequisites_section?.learning_units) {
    for (const unit of structure.prerequisites_section.learning_units) {
      for (const sq of unit.search_queries || []) {
        queries.push({
          unit_id: unit.unit_id,
          section_id: 'prerequisites',
          section_type: 'prerequisite',
          topic: unit.topic,
          query: sq.query,
          query_type: sq.query_type,
          target_content: sq.target_content,
          priority: sq.priority,
        });
      }
    }
  }

  // Flatten content section queries
  for (const section of structure.content_sections || []) {
    for (const unit of section.learning_units || []) {
      for (const sq of unit.search_queries || []) {
        queries.push({
          unit_id: unit.unit_id,
          section_id: section.section_id,
          section_type: 'content',
          topic: unit.topic,
          query: sq.query,
          query_type: sq.query_type,
          target_content: sq.target_content,
          priority: sq.priority,
        });
      }
    }
  }

  return queries;
}

/**
 * Generate embeddings for target resource profiles in all learning units
 * This pre-computes embeddings to avoid redundant generation during search phase
 * Embeddings are stored in Pinecone (3072-dim vectors in 'target_profiles' namespace)
 * NOT stored in Supabase to reduce storage bloat (~100k chars per embedding)
 */
async function generateTargetResourceEmbeddings(structure: LearningStructure, blueprintId: string): Promise<void> {
  let totalUnits = 0;
  let successCount = 0;
  let failCount = 0;
  const pineconeVectors: any[] = [];

  // Process prerequisite units
  if (structure.prerequisites_section?.learning_units) {
    totalUnits += structure.prerequisites_section.learning_units.length;

    for (const unit of structure.prerequisites_section.learning_units) {
      try {
        // Use target_resource_profile if available, otherwise construct from semantic_search_phrase or topic
        const embeddingText = unit.target_resource_profile
          || unit.semantic_search_phrase
          || `${unit.topic} ${unit.description || ''} ${unit.learning_objective || ''}`;

        const result = await generateEmbedding(embeddingText.trim());

        // ATTACH EMBEDDING TO UNIT FOR CACHING
        // This ensures prepareSectionsForCache has valid data
        unit.target_resource_embedding = result.embedding;

        // Prepare vector for Pinecone storage (NOT stored in unit to reduce Supabase bloat)
        const vectorId = `target-${blueprintId}-${unit.unit_id}`;
        pineconeVectors.push({
          id: vectorId,
          values: result.embedding,
          metadata: {
            blueprint_id: blueprintId,
            unit_id: unit.unit_id,
            topic: unit.topic,
            unit_type: unit.unit_type || 'prerequisite',
            section_id: 'prerequisites', // Hardcoded for prereq section
            target_resource_profile: (embeddingText || '').substring(0, 1000), // Truncate for metadata limit
            type: 'target_profile'
          }
        });

        successCount++;
      } catch (error) {
        console.error(`[generate-structure] Failed to generate embedding for unit "${unit.topic}":`, error);
        failCount++;
      }
    }
  }

  // Process content section units
  for (const section of structure.content_sections || []) {
    if (section.learning_units) {
      totalUnits += section.learning_units.length;

      for (const unit of section.learning_units) {
        try {
          // Use target_resource_profile if available, otherwise construct from semantic_search_phrase or topic
          const embeddingText = unit.target_resource_profile
            || unit.semantic_search_phrase
            || `${unit.topic} ${unit.description || ''} ${unit.learning_objective || ''}`;

          const result = await generateEmbedding(embeddingText.trim());

          // ATTACH EMBEDDING TO UNIT FOR CACHING
          unit.target_resource_embedding = result.embedding;

          // Prepare vector for Pinecone storage (NOT stored in unit to reduce Supabase bloat)
          const vectorId = `target-${blueprintId}-${unit.unit_id}`;
          pineconeVectors.push({
            id: vectorId,
            values: result.embedding,
            metadata: {
              blueprint_id: blueprintId,
              unit_id: unit.unit_id,
              topic: unit.topic,
              unit_type: unit.unit_type || 'topic',
              section_id: section.section_id,
              target_resource_profile: (embeddingText || '').substring(0, 1000), // Truncate for metadata limit
              type: 'target_profile'
            }
          });

          successCount++;
        } catch (error) {
          console.error(`[generate-structure] Failed to generate embedding for unit "${unit.topic}":`, error);
          failCount++;
        }
      }
    }
  }

  // Store all embeddings in Pinecone target_profiles namespace
  if (pineconeVectors.length > 0) {
    try {
      console.log(`[generate-structure] Storing ${pineconeVectors.length} target profiles in Pinecone...`);
      await upsertVectors(pineconeVectors, 'target_profiles');
      console.log(`[generate-structure] ✅ Successfully stored ${pineconeVectors.length} target profiles in Pinecone`);
    } catch (pineconeError) {
      console.error('[generate-structure] ❌ Failed to store target profiles in Pinecone:', pineconeError);
      // Don't fail the whole operation - embeddings can be regenerated on-demand during search
    }
  }

  console.log(`[generate-structure] Target resource embedding generation complete:`);
  console.log(`  - Total units: ${totalUnits}`);
  console.log(`  - Success: ${successCount}`);
  console.log(`  - Failed: ${failCount}`);
  console.log(`  - Stored in Pinecone: ${pineconeVectors.length}`);
}

/**
 * Count totals from the structure
 */
function countStructureMetrics(structure: LearningStructure) {
  const prerequisiteUnits = structure.prerequisites_section?.learning_units?.length || 0;
  const contentSections = structure.content_sections?.length || 0;

  let totalLearningUnits = prerequisiteUnits;
  let totalSearchQueries = 0;

  // Count prerequisite queries
  for (const unit of structure.prerequisites_section?.learning_units || []) {
    totalSearchQueries += unit.search_queries?.length || 0;
  }

  // Count content section units and queries
  for (const section of structure.content_sections || []) {
    totalLearningUnits += section.learning_units?.length || 0;
    for (const unit of section.learning_units || []) {
      totalSearchQueries += unit.search_queries?.length || 0;
    }
  }

  return {
    total_prerequisites: prerequisiteUnits,
    total_sections: contentSections,
    total_learning_units: totalLearningUnits,
    total_search_queries: totalSearchQueries,
  };
}

// ============================================================================
// EQUATION CACHING FUNCTIONS
// ============================================================================

interface CachedEquation {
  id: string;
  name: string;
  latex: string;
  variables: Record<string, string>;
  when_to_use: string;
  from_cache: boolean;
}

/**
 * Try to find an existing equation by exact name match (case-insensitive)
 */
async function findEquationByName(
  supabase: any,
  name: string
): Promise<CachedEquation | null> {
  const { data, error } = await supabase
    .from('curated_equations')
    .select('*')
    .ilike('name', name)
    .order('times_used', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    latex: data.latex,
    variables: data.variables || {},
    when_to_use: data.when_to_use || '',
    from_cache: true,
  };
}

/**
 * Create a new equation in the database and return it
 */
async function createEquation(
  supabase: any,
  equation: Equation,
  subjectArea: string,
  userId: string | null
): Promise<CachedEquation | null> {
  try {
    // Generate embedding for the equation name + context for future similarity matching
    const embeddingText = `${equation.name}: ${equation.when_to_use || ''} ${Object.keys(equation.variables || {}).join(' ')}`;

    let embedding: number[] | null = null;
    try {
      const result = await generateEmbedding1536(embeddingText);
      embedding = result.embedding;
    } catch (embError) {
      console.log('[generate-structure] Could not generate equation embedding:', embError);
      // Continue without embedding - we can add it later
    }

    const insertData: any = {
      name: equation.name,
      latex: equation.latex,
      variables: equation.variables || {},
      when_to_use: equation.when_to_use || '',
      subject_area: subjectArea,
      topic_tags: Object.keys(equation.variables || {}),
      times_used: 1,
      created_by: userId,
    };

    if (embedding) {
      insertData.name_embedding = embedding;
    }

    const { data, error } = await supabase
      .from('curated_equations')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // If it's a unique constraint violation, try to fetch the existing one
      if (error.code === '23505') {
        console.log('[generate-structure] Equation already exists, fetching...');
        return await findEquationByName(supabase, equation.name);
      }
      console.error('[generate-structure] Error creating equation:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      latex: data.latex,
      variables: data.variables || {},
      when_to_use: data.when_to_use || '',
      from_cache: false,
    };
  } catch (err) {
    console.error('[generate-structure] Exception creating equation:', err);
    return null;
  }
}

/**
 * Process all equations in a learning unit - cache new ones, reuse existing
 */
async function processUnitEquations(
  supabase: any,
  blueprintId: string | null,
  unitId: string,
  equations: Equation[] | undefined,
  subjectArea: string,
  userId: string | null
): Promise<{ processedEquations: CachedEquation[]; cachedCount: number; newCount: number }> {
  if (!equations || equations.length === 0) {
    return { processedEquations: [], cachedCount: 0, newCount: 0 };
  }

  const processedEquations: CachedEquation[] = [];
  let cachedCount = 0;
  let newCount = 0;

  for (const equation of equations) {
    // Try to find existing equation by name
    let cached = await findEquationByName(supabase, equation.name);

    if (cached) {
      console.log(`[generate-structure] Found cached equation: ${equation.name}`);
      cachedCount++;

      // Increment usage counter using the RPC function we created
      await supabase.rpc('increment_equation_usage', { equation_uuid: cached.id });

    } else {
      // Create new equation
      console.log(`[generate-structure] Creating new equation: ${equation.name}`);
      cached = await createEquation(supabase, equation, subjectArea, userId);
      if (cached) {
        newCount++;
      }
    }

    if (cached) {
      processedEquations.push(cached);

      // Link equation to this blueprint/unit if we have a blueprint
      if (blueprintId) {
        await supabase
          .from('blueprint_unit_equations')
          .upsert({
            blueprint_id: blueprintId,
            unit_id: unitId,
            equation_id: cached.id,
            display_index: equation.index || processedEquations.length,
            from_cache: cached.from_cache,
          }, {
            onConflict: 'blueprint_id,unit_id,equation_id',
          });
      }
    }
  }

  return { processedEquations, cachedCount, newCount };
}

/**
 * Process all equations in the structure - cache and link them
 */
async function processStructureEquations(
  supabase: any,
  structure: LearningStructure,
  blueprintId: string | null,
  subjectArea: string,
  userId: string | null
): Promise<{ totalCached: number; totalNew: number }> {
  let totalCached = 0;
  let totalNew = 0;

  // Process prerequisite equations
  if (structure.prerequisites_section?.learning_units) {
    for (const unit of structure.prerequisites_section.learning_units) {
      const result = await processUnitEquations(
        supabase, blueprintId, unit.unit_id, unit.equations, subjectArea, userId
      );
      totalCached += result.cachedCount;
      totalNew += result.newCount;
    }
  }

  // Process content section equations
  for (const section of structure.content_sections || []) {
    for (const unit of section.learning_units || []) {
      const result = await processUnitEquations(
        supabase, blueprintId, unit.unit_id, unit.equations, subjectArea, userId
      );
      totalCached += result.cachedCount;
      totalNew += result.newCount;
    }
  }

  return { totalCached, totalNew };
}

// ============================================================================
// AGGRESSIVE EQUATION DETECTION (POST-PROCESSING)
// ============================================================================

/**
 * Search for equations by topic/keyword similarity
 * This helps find relevant equations even if the AI didn't include them
 */
async function searchEquationsByTopic(
  supabase: any,
  topic: string,
  description: string,
  subjectArea: string
): Promise<CachedEquation[]> {
  const searchText = `${topic} ${description || ''}`.toLowerCase();

  // Try exact name matches first (case-insensitive)
  const { data: exactMatches } = await supabase
    .from('curated_equations')
    .select('*')
    .eq('subject_area', subjectArea)
    .ilike('name', `%${topic}%`)
    .order('times_used', { ascending: false })
    .limit(3);

  if (exactMatches && exactMatches.length > 0) {
    return exactMatches.map((eq: any) => ({
      id: eq.id,
      name: eq.name,
      latex: eq.latex,
      variables: eq.variables || {},
      when_to_use: eq.when_to_use || '',
      from_cache: true,
    }));
  }

  // Try topic tags match
  const { data: tagMatches } = await supabase
    .from('curated_equations')
    .select('*')
    .eq('subject_area', subjectArea)
    .contains('topic_tags', [topic.toLowerCase()])
    .order('times_used', { ascending: false })
    .limit(3);

  if (tagMatches && tagMatches.length > 0) {
    return tagMatches.map((eq: any) => ({
      id: eq.id,
      name: eq.name,
      latex: eq.latex,
      variables: eq.variables || {},
      when_to_use: eq.when_to_use || '',
      from_cache: true,
    }));
  }

  return [];
}

/**
 * Post-process structure to detect and attach missing equations
 * This is the "aggressive" detection that finds equations even when AI didn't include them
 */
async function detectAndAttachMissingEquations(
  supabase: any,
  structure: LearningStructure,
  blueprintId: string | null,
  subjectArea: string,
  userId: string | null
): Promise<{ addedCount: number }> {
  let addedCount = 0;

  console.log('[generate-structure] Running aggressive equation detection...');

  // Process prerequisites
  if (structure.prerequisites_section?.learning_units) {
    for (const unit of structure.prerequisites_section.learning_units) {
      if (!unit.equations || unit.equations.length === 0) {
        const foundEquations = await searchEquationsByTopic(
          supabase,
          unit.topic,
          unit.description || '',
          subjectArea
        );

        if (foundEquations.length > 0) {
          console.log(`[generate-structure] Found ${foundEquations.length} equations for prerequisite "${unit.topic}"`);

          // Add to unit structure
          if (!unit.equations) {
            unit.equations = [];
          }

          for (const eq of foundEquations) {
            unit.equations.push({
              index: unit.equations.length + 1,
              name: eq.name,
              latex: eq.latex,
              variables: eq.variables,
              when_to_use: eq.when_to_use,
            });

            // Link to blueprint if available
            if (blueprintId) {
              await supabase
                .from('blueprint_unit_equations')
                .upsert({
                  blueprint_id: blueprintId,
                  unit_id: unit.unit_id,
                  equation_id: eq.id,
                  display_index: unit.equations.length,
                  from_cache: true,
                }, {
                  onConflict: 'blueprint_id,unit_id,equation_id',
                });
            }

            // Increment usage
            await supabase.rpc('increment_equation_usage', { equation_uuid: eq.id });
            addedCount++;
          }
        }
      }
    }
  }

  // Process content sections
  for (const section of structure.content_sections || []) {
    for (const unit of section.learning_units || []) {
      if (!unit.equations || unit.equations.length === 0) {
        const foundEquations = await searchEquationsByTopic(
          supabase,
          unit.topic,
          unit.description || '',
          subjectArea
        );

        if (foundEquations.length > 0) {
          console.log(`[generate-structure] Found ${foundEquations.length} equations for unit "${unit.topic}"`);

          // Add to unit structure
          if (!unit.equations) {
            unit.equations = [];
          }

          for (const eq of foundEquations) {
            unit.equations.push({
              index: unit.equations.length + 1,
              name: eq.name,
              latex: eq.latex,
              variables: eq.variables,
              when_to_use: eq.when_to_use,
            });

            // Link to blueprint if available
            if (blueprintId) {
              await supabase
                .from('blueprint_unit_equations')
                .upsert({
                  blueprint_id: blueprintId,
                  unit_id: unit.unit_id,
                  equation_id: eq.id,
                  display_index: unit.equations.length,
                  from_cache: true,
                }, {
                  onConflict: 'blueprint_id,unit_id,equation_id',
                });
            }

            // Increment usage
            await supabase.rpc('increment_equation_usage', { equation_uuid: eq.id });
            addedCount++;
          }
        }
      }
    }
  }

  console.log(`[generate-structure] Aggressive detection added ${addedCount} equations`);
  return { addedCount };
}

// ============================================================================
// FIGURE PROCESSING
// ============================================================================

/**
 * Process suggested figures from the structure and source them from Wikimedia Commons
 */
async function processSuggestedFigures(
  supabase: any,
  structure: LearningStructure,
  blueprintId: string | null,
  subjectArea: string,
  userId: string | null
): Promise<{ totalProcessed: number; totalCached: number; totalNew: number }> {
  let totalProcessed = 0;
  let totalCached = 0;
  let totalNew = 0;

  console.log('[generate-structure] Processing suggested figures...');

  // Process prerequisites
  if (structure.prerequisites_section?.learning_units) {
    for (const unit of structure.prerequisites_section.learning_units) {
      if (unit.suggested_figures && unit.suggested_figures.length > 0) {
        for (const suggestedFigure of unit.suggested_figures) {
          totalProcessed++;

          const figure = await findOrCreateFigure(
            supabase,
            suggestedFigure.name,
            suggestedFigure.description,
            suggestedFigure.figure_type,
            suggestedFigure.search_terms,
            subjectArea,
            suggestedFigure.search_terms,
            [unit.topic],
            userId
          );

          if (figure) {
            if (figure.from_cache) {
              totalCached++;
            } else {
              totalNew++;
            }

            // Link figure to blueprint unit
            if (blueprintId) {
              await supabase
                .from('blueprint_unit_figures')
                .upsert({
                  blueprint_id: blueprintId,
                  unit_id: unit.unit_id,
                  figure_id: figure.id,
                  display_index: 1,
                  from_cache: figure.from_cache,
                  relevance_explanation: suggestedFigure.description,
                }, {
                  onConflict: 'blueprint_id,unit_id,figure_id',
                });
            }

            console.log(`[generate-structure] ✓ Figure "${suggestedFigure.name}" ${figure.from_cache ? 'from cache' : 'newly created'}`);
          } else {
            console.log(`[generate-structure] ✗ Could not source figure "${suggestedFigure.name}"`);
          }
        }
      }
    }
  }

  // Process content sections
  for (const section of structure.content_sections || []) {
    for (const unit of section.learning_units || []) {
      if (unit.suggested_figures && unit.suggested_figures.length > 0) {
        for (const suggestedFigure of unit.suggested_figures) {
          totalProcessed++;

          const figure = await findOrCreateFigure(
            supabase,
            suggestedFigure.name,
            suggestedFigure.description,
            suggestedFigure.figure_type,
            suggestedFigure.search_terms,
            subjectArea,
            suggestedFigure.search_terms,
            [unit.topic],
            userId
          );

          if (figure) {
            if (figure.from_cache) {
              totalCached++;
            } else {
              totalNew++;
            }

            // Link figure to blueprint unit
            if (blueprintId) {
              await supabase
                .from('blueprint_unit_figures')
                .upsert({
                  blueprint_id: blueprintId,
                  unit_id: unit.unit_id,
                  figure_id: figure.id,
                  display_index: 1,
                  from_cache: figure.from_cache,
                  relevance_explanation: suggestedFigure.description,
                }, {
                  onConflict: 'blueprint_id,unit_id,figure_id',
                });
            }

            console.log(`[generate-structure] ✓ Figure "${suggestedFigure.name}" ${figure.from_cache ? 'from cache' : 'newly created'}`);
          } else {
            console.log(`[generate-structure] ✗ Could not source figure "${suggestedFigure.name}"`);
          }
        }
      }
    }
  }

  console.log(`[generate-structure] Figures processed: ${totalProcessed} suggested, ${totalCached} cached, ${totalNew} new`);
  return { totalProcessed, totalCached, totalNew };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  let blueprint_id: string | null = null;
  const supabase = createSupabaseClient();

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const body: GenerateStructureRequest = await req.json();
    blueprint_id = body.blueprint_id || null;

    console.log(`[generate-structure] Starting structure generation`);
    console.log(`  - Blueprint ID: ${blueprint_id || '(none - direct input)'}`);
    console.log(`  - Input type: ${body.input_type || 'document_analysis'}`);

    // Get the input data
    let analysisData: any;
    let userId: string;
    let analysisId: string | null = null;
    let documentId: string | null = null;

    if (blueprint_id) {
      // Fetch blueprint and its analysis
      const authClient = createSupabaseClientWithAuth(authHeader);

      const { data: blueprint, error: blueprintError } = await authClient
        .from('blueprints')
        .select('*')
        .eq('id', blueprint_id)
        .single();

      if (blueprintError || !blueprint) {
        console.error('Blueprint fetch error:', blueprintError);
        throw new Error('Blueprint not found or access denied');
      }

      userId = blueprint.user_id;
      documentId = blueprint.document_id || null;
      console.log(`[generate-structure] Found blueprint: ${blueprint.title || blueprint_id}`);
      console.log(`[generate-structure] Blueprint document_id: ${documentId || '(none)'}`);

      // =========================================================================
      // Find the document analysis - prioritize document_id (new model)
      // =========================================================================
      let analysis = null;

      // Approach 1: Search by document_id (preferred - new data model)
      if (documentId) {
        console.log(`[generate-structure] Searching by document_id: ${documentId}`);
        const { data: docMatch, error: docError } = await supabase
          .from('document_analyses')
          .select('*')
          .eq('document_id', documentId)
          .maybeSingle();

        if (docError) {
          console.error('[generate-structure] document_id match error:', docError);
        }

        if (docMatch) {
          console.log('[generate-structure] Found analysis by document_id:', docMatch.id);
          analysis = docMatch;
        }
      }

      // Approach 2: Search by blueprint_id (legacy/backwards compat)
      if (!analysis) {
        console.log(`[generate-structure] Searching by blueprint_id: ${blueprint_id}`);
        const { data: bpMatch, error: bpError } = await supabase
          .from('document_analyses')
          .select('*')
          .eq('blueprint_id', blueprint_id)
          .maybeSingle();

        if (bpError) {
          console.error('[generate-structure] blueprint_id match error:', bpError);
        }

        if (bpMatch) {
          console.log('[generate-structure] Found analysis by blueprint_id:', bpMatch.id);
          analysis = bpMatch;
        }
      }

      // Approach 3: Search by document filename
      if (!analysis) {
        const fileName = blueprint.file_metadata?.name || blueprint.content?.fileUpload?.name;

        if (fileName) {
          console.log(`[generate-structure] Searching by filename: ${fileName}`);

          const { data: filenameMatch, error: filenameError } = await supabase
            .from('document_analyses')
            .select('*')
            .eq('source_filename', fileName)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (filenameError) {
            console.error('[generate-structure] Filename match error:', filenameError);
          }

          if (filenameMatch) {
            console.log('[generate-structure] Found analysis by filename:', filenameMatch.id);
            analysis = filenameMatch;
          }
        }
      }

      // Approach 4: Check if there's any analysis for this user's class
      if (!analysis && blueprint.class_id) {
        console.log(`[generate-structure] Searching by class_id: ${blueprint.class_id}`);

        const { data: classMatch, error: classError } = await supabase
          .from('document_analyses')
          .select('*')
          .eq('class_id', blueprint.class_id)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (classMatch) {
          console.log('[generate-structure] Found analysis by class_id:', classMatch.id);
          analysis = classMatch;
        }
      }

      if (!analysis) {
        console.error('[generate-structure] No analysis found after all search attempts');
        console.error('[generate-structure] Blueprint details:', {
          id: blueprint_id,
          document_id: documentId,
          user_id: userId,
          class_id: blueprint.class_id,
          file_name: blueprint.file_metadata?.name || blueprint.content?.fileUpload?.name,
        });
        throw new Error('Document analysis not found. Please run the analyze-document step first.');
      }

      analysisId = analysis.id;
      analysisData = analysis.raw_analysis;

      // Extract student's text context from the blueprint (if they provided additional context)
      const studentContext = blueprint.description || blueprint.content?.textInput || '';
      if (studentContext && studentContext.trim().length > 0) {
        // Attach student context to analysis data so it can influence structure generation
        analysisData.student_context = studentContext.trim();
        console.log(`[generate-structure] Student provided context: "${studentContext.substring(0, 100)}${studentContext.length > 100 ? '...' : ''}"`);
      }

      console.log(`[generate-structure] Found document analysis: ${analysisId}`);
      console.log(`  - Document type: ${analysisData.document_type}`);
      console.log(`  - Problems: ${analysisData.problems?.length || 0}`);
      console.log(`  - Prerequisites: ${analysisData.prerequisites?.length || 0}`);

      // Delete any existing learning structure for this blueprint (to allow retry)
      const { error: deleteError } = await supabase
        .from('blueprint_structures')
        .delete()
        .eq('blueprint_id', blueprint_id);

      if (deleteError) {
        console.log('[generate-structure] No existing structure to delete or delete failed:', deleteError);
      }

      // Update blueprint status
      await supabase
        .from('blueprints')
        .update({
          generation_status: 'generating_structure',
          generation_error: null,
        })
        .eq('id', blueprint_id);

      // =========================================================================
      // CHECK STRUCTURE CACHE (NEW!)
      // =========================================================================
      // Check if we have a similar blueprint structure cached
      // This can save 20,000-24,000 tokens (~$0.05-0.06 per cache hit)
      // 
      // IMPORTANT: Skip cache when student provided text input!
      // Text inputs are almost always personalized/contextual and should NOT
      // match cached structures from other documents/submissions.
      // =========================================================================

      const hasStudentContext = !!(analysisData.student_context && analysisData.student_context.trim().length > 0);

      if (hasStudentContext) {
        console.log('[generate-structure] ========================================');
        console.log('[generate-structure] SKIPPING CACHE - Student provided text context');
        console.log('[generate-structure] ========================================');
        console.log('[generate-structure] Text inputs are personalized - generating fresh structure');
      } else {
        console.log('[generate-structure] ========================================');
        console.log('[generate-structure] CHECKING SECTION-LEVEL CACHE');
        console.log('[generate-structure] ========================================');
      }

      // Only check cache when there's no student context
      // Text inputs mean personalized content that shouldn't use cached structures
      if (!hasStudentContext) {
        // Create a synthetic prerequisites section for cache checking
        // This allows prerequisites to be cached and retrieved like other sections
        const prerequisitesSection = analysisData.prerequisites && analysisData.prerequisites.length > 0 ? {
          section_id: 'prerequisites',
          section_type: 'topic' as const,
          topic_summary: `Prerequisites: ${analysisData.prerequisites.map((p: any) => p.concept || p).join(', ')}`,
          concepts_tested: analysisData.prerequisites.map((p: any) => p.concept || p)
        } : null;

        // Prepare analysis data with prerequisites section included
        const analysisWithPrereqs = {
          ...analysisData,
          sections: prerequisitesSection
            ? [prerequisitesSection, ...(analysisData.sections || [])]
            : (analysisData.sections || [])
        };

        // NEW: Check cache for each section individually (including prerequisites)
        const sectionsWithEmbeddings = await generateAllSectionEmbeddings(analysisWithPrereqs);
        console.log(`[generate-structure] Generated embeddings for ${sectionsWithEmbeddings.length} sections (including prerequisites: ${!!prerequisitesSection})`);

        // Check cache for each section (Pinecone first, then Supabase fallback)
        const cacheResults = [];
        let cachedSectionsCount = 0;

        for (const sectionWithEmbedding of sectionsWithEmbeddings) {
          let cacheHit = false;
          let cachedData = null;

          // Try Pinecone first (3072-dim, higher precision)
          try {
            const pineconeResults = await querySimilarSectionsFromPinecone(
              sectionWithEmbedding.embedding,
              sectionWithEmbedding.section_type,
              0.95, // 95% similarity threshold
              supabase, // Pass Supabase client to fetch full cached_unit
              analysisData.subject_area, // CRITICAL: Filter by subject to avoid cross-contamination
              analysisData.specific_topic // CRITICAL: Filter by topic for precise matching
            );

            if (pineconeResults && pineconeResults.length > 0) {
              cachedData = pineconeResults[0];
              cacheHit = true;
              console.log(`[generate-structure] ✅ PINECONE CACHE HIT for ${sectionWithEmbedding.section_id}! Similarity: ${(cachedData.similarity * 100).toFixed(1)}%`);
            }
          } catch (pineconeError) {
            console.error(`[generate-structure] Pinecone cache lookup error for ${sectionWithEmbedding.section_id}:`, pineconeError);
          }

          // Fallback to Supabase if Pinecone didn't return results
          if (!cacheHit) {
            const { data, error } = await supabase.rpc('search_similar_sections', {
              query_embedding: sectionWithEmbedding.embedding,
              p_section_type: sectionWithEmbedding.section_type,
              p_subject_area: analysisData.subject_area,
              p_document_type: analysisData.document_type,
              similarity_threshold: 0.95,
              max_results: 1
            });

            if (!error && data && data.length > 0) {
              cachedData = data[0];
              cacheHit = true;
              console.log(`[generate-structure] ✅ SUPABASE CACHE HIT for ${sectionWithEmbedding.section_id}! Similarity: ${(cachedData.similarity * 100).toFixed(1)}%`);

              // Increment usage for Supabase cache
              await supabase.rpc('increment_section_cache_usage', { cache_id: cachedData.id });
            }
          }

          if (cacheHit && cachedData) {
            // CRITICAL: Verify cached_unit is present and has data
            console.log(`[generate-structure] Checking cached_unit for ${sectionWithEmbedding.section_id}:`);
            console.log(`[generate-structure]   - cachedData exists: ${!!cachedData}`);
            console.log(`[generate-structure]   - cachedData.cached_unit exists: ${!!cachedData.cached_unit}`);
            console.log(`[generate-structure]   - cachedData.cached_unit type: ${typeof cachedData.cached_unit}`);

            if (cachedData.cached_unit) {
              console.log(`[generate-structure]   - cached_unit keys: ${Object.keys(cachedData.cached_unit).join(', ')}`);
              // Check for units array or single unit
              if (cachedData.cached_unit.units) {
                console.log(`[generate-structure]   - Has units array: ${cachedData.cached_unit.units.length} units`);
              } else if (cachedData.cached_unit.topic) {
                console.log(`[generate-structure]   - Single unit with topic: "${cachedData.cached_unit.topic}"`);
                console.log(`[generate-structure]   - Has tutor_guidance: ${!!cachedData.cached_unit.tutor_guidance}`);
              }

              // CRITICAL CHECK: Invalidate cache if suggested_figures are missing
              // This forces regeneration for older units that were created before the figure system
              const hasSuggestedFigures = (
                (cachedData.cached_unit.units && cachedData.cached_unit.units.every((u: any) => u.suggested_figures)) ||
                (cachedData.cached_unit.suggested_figures !== undefined)
              );

              if (!hasSuggestedFigures) {
                console.log(`[generate-structure] ⚠️ Cache hit BUT missing suggested_figures - Treating as MISS to force regeneration`);
                // Do NOT mark as valid cache
              } else {
                // Valid cache
                cacheResults.push({
                  section_id: sectionWithEmbedding.section_id,
                  cache_hit: true,
                  cached_unit: cachedData.cached_unit,
                  similarity: cachedData.similarity,
                  source: cachedData.source || 'supabase'
                });
                cachedSectionsCount++;
              }
            } else {
              console.warn(`[generate-structure] ⚠️ cached_unit is NULL/undefined for ${sectionWithEmbedding.section_id}!`);
              // Treat as miss (fall through to implicit else below)
            }
          }

          // Note: If we fell through (invalid cache or no cache data), we treat as miss
          if (cacheResults.length === 0 || cacheResults[cacheResults.length - 1].section_id !== sectionWithEmbedding.section_id) {
            console.log(`[generate-structure] ❌ CACHE MISS (or Invalid) for ${sectionWithEmbedding.section_id}`);
            cacheResults.push({
              section_id: sectionWithEmbedding.section_id,
              cache_hit: false
            });
          }
        }

        const cacheHitRate = sectionsWithEmbeddings.length > 0 ? cachedSectionsCount / sectionsWithEmbeddings.length : 0;
        console.log(`[generate-structure] Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}% (${cachedSectionsCount}/${sectionsWithEmbeddings.length} sections)`);

        // Store cache results for later use
        (analysisData as any).cacheResults = cacheResults;
        (analysisData as any).cacheHitRate = cacheHitRate;
        (analysisData as any).cachedSectionsCount = cachedSectionsCount;

        if (cachedSectionsCount > 0) {
          console.log(`[generate-structure] Found ${cachedSectionsCount}/${sectionsWithEmbeddings.length} cached sections`);
        } else {
          console.log('[generate-structure] No cache hits - will generate fresh structure');
        }
      } else {
        // hasStudentContext is true - skip cache entirely
        // Set cache values to indicate no cache was used
        (analysisData as any).cacheResults = [];
        (analysisData as any).cacheHitRate = 0;
        (analysisData as any).cachedSectionsCount = 0;
      }

    } else if (body.analysis) {
      // Direct input mode
      analysisData = body.analysis;

      // Get user from auth
      const authClient = createSupabaseClientWithAuth(authHeader);
      const { data: { user }, error: userError } = await authClient.auth.getUser();

      if (userError || !user) {
        throw new Error('Could not verify user');
      }

      userId = user.id;
      console.log(`[generate-structure] Using direct input mode`);
    } else {
      throw new Error('Must provide either blueprint_id or analysis data');
    }

    // Declare structure variable
    let structure: LearningStructure;
    let usedCache = false;

    // Use cached sections whenever available (even for partial hits)
    const cacheData = (analysisData as any);
    if (cacheData.cachedSectionsCount > 0) {
      console.log(`[generate-structure] ✅ CACHE HIT! Found ${cacheData.cachedSectionsCount}/${cacheData.cacheResults.length} cached sections`);
      console.log(`[generate-structure]   - Cache hit rate: ${(cacheData.cacheHitRate * 100).toFixed(1)}%`);
      console.log(`[generate-structure]   - Token savings: ~${cacheData.cachedSectionsCount * 1000} tokens`);
      console.log(`[generate-structure]   - Time savings: ~${cacheData.cachedSectionsCount * 3} seconds`);

      // Build structure from cached sections
      // IMPORTANT: Include summary field for complete structure
      structure = {
        summary: {
          title: analysisData.specific_topic || analysisData.subject_area || 'Learning Structure',
          description: `Learning structure for ${analysisData.document_type || 'document'}`,
          total_estimated_time_minutes: 60, // Will be recalculated from units
          difficulty_progression: analysisData.course_level || 'intermediate'
        },
        subject_area: analysisData.subject_area,
        specific_topic: analysisData.specific_topic,
        document_type: analysisData.document_type,
        course_level: analysisData.course_level,
        prerequisites_section: {
          description: "Prerequisites for this document",
          learning_units: []
        },
        content_sections: []
      };

      // Map cached sections to content_sections and prerequisites
      const missedSections: string[] = [];
      let totalEstimatedTime = 0;

      console.log(`[generate-structure] Processing ${cacheData.cacheResults.length} cache results...`);

      for (const cacheResult of cacheData.cacheResults) {
        console.log(`[generate-structure] Processing cache result for "${cacheResult.section_id}":`);
        console.log(`[generate-structure]   - cache_hit: ${cacheResult.cache_hit}`);
        console.log(`[generate-structure]   - cached_unit exists: ${!!cacheResult.cached_unit}`);
        console.log(`[generate-structure]   - cached_unit type: ${typeof cacheResult.cached_unit}`);
        if (cacheResult.cached_unit) {
          console.log(`[generate-structure]   - cached_unit keys: ${Object.keys(cacheResult.cached_unit).join(', ')}`);
        }

        if (cacheResult.cache_hit && cacheResult.cached_unit) {
          // Extract learning units from cached_unit
          let learningUnits: LearningUnit[] = [];
          if (Array.isArray(cacheResult.cached_unit.units)) {
            // Multiple units stored
            learningUnits = cacheResult.cached_unit.units;
          } else if (cacheResult.cached_unit.topic) {
            // Single unit stored
            learningUnits = [cacheResult.cached_unit];
          }

          // CHECK FOR NEW FIELDS (Concept Summary)
          // If missing, invalidate cache to force regeneration
          const isMissingSummary = learningUnits.some((u: any) => !u.concept_summary);

          if (isMissingSummary) {
            console.log(`[generate-structure] ⚠️ Cache invalid for ${cacheResult.section_id}: Missing concept_summary field. Forcing regeneration.`);
            missedSections.push(cacheResult.section_id);
          } else {
            // USE CACHE
            // DETAILED VERIFICATION: Log ALL fields from cached units
            console.log(`[generate-structure] ✅ CACHE HIT for section: ${cacheResult.section_id}`);
            console.log(`[generate-structure]   - Similarity: ${(cacheResult.similarity * 100).toFixed(1)}%`);
            console.log(`[generate-structure]   - Units count: ${learningUnits.length}`);

            for (let i = 0; i < learningUnits.length; i++) {
              const unit = learningUnits[i];
              console.log(`[generate-structure]   Unit ${i + 1} (${unit.unit_id || 'no-id'}):`);
              console.log(`[generate-structure]     - topic: ${unit.topic ? '✓' : '✗'} "${unit.topic?.substring(0, 50) || 'MISSING'}"`);
              console.log(`[generate-structure]     - concept_summary: ${unit.concept_summary ? '✓' : '✗'} "${unit.concept_summary?.substring(0, 30) || 'MISSING'}"`);
              console.log(`[generate-structure]     - tutor_guidance: ${unit.tutor_guidance ? '✓' : '✗'} (${unit.tutor_guidance?.length || 0} chars)`);
              console.log(`[generate-structure]     - target_resource_profile: ${unit.target_resource_profile ? '✓' : '✗'} (${unit.target_resource_profile?.length || 0} chars)`);
              console.log(`[generate-structure]     - target_resource_embedding: ${unit.target_resource_embedding ? '✓' : '✗'} (${unit.target_resource_embedding?.length || 0} dims)`);
              console.log(`[generate-structure]     - equations: ${unit.equations ? '✓' : '✗'} (${unit.equations?.length || 0} equations)`);
              console.log(`[generate-structure]     - search_queries: ${unit.search_queries ? '✓' : '✗'} (${unit.search_queries?.length || 0} queries)`);
              console.log(`[generate-structure]     - estimated_time_minutes: ${unit.estimated_time_minutes || 0}`);

              // Accumulate time
              totalEstimatedTime += unit.estimated_time_minutes || 15;

              // Log equations if present
              if (unit.equations && unit.equations.length > 0) {
                console.log(`[generate-structure]     - Equation names: ${unit.equations.map((e: any) => e.name).join(', ')}`);
              }
            }

            // Check if this is prerequisites or a content section
            if (cacheResult.section_id === 'prerequisites') {
              // Load prerequisites from cache
              structure.prerequisites_section.learning_units = learningUnits;
              console.log(`[generate-structure] ✅ Loaded ${learningUnits.length} prerequisite units from cache (VERBATIM)`);
            } else {
              // Load content section from cache
              const originalSection = analysisData.sections?.find((s: any) => s.section_id === cacheResult.section_id);
              structure.content_sections.push({
                section_id: cacheResult.section_id,
                section_type: originalSection?.section_type || 'problem',
                title: originalSection?.section_id || cacheResult.section_id,
                description: originalSection?.problem_statement || originalSection?.topic_summary || '',
                concepts: originalSection?.concepts_tested || [],
                learning_units: learningUnits // EXACT cached units
              });
            }
          }
        } else {
          missedSections.push(cacheResult.section_id);
        }
      }

      // Update total estimated time in summary
      structure.summary.total_estimated_time_minutes = totalEstimatedTime;

      // Generate only the missed sections with AI
      if (missedSections.length > 0) {
        console.log(`[generate-structure] ⚠️  ${missedSections.length} sections not in cache: ${missedSections.join(', ')}`);
        console.log('[generate-structure] Generating ONLY missed sections with AI...');

        // Filter analysisData to only include missed sections
        // IMPORTANT: Don't include cacheResults or other large objects - they bloat the prompt!
        const missedAnalysis = {
          subject_area: analysisData.subject_area,
          specific_topic: analysisData.specific_topic,
          document_type: analysisData.document_type,
          course_level: analysisData.course_level,
          prerequisites: analysisData.prerequisites,
          // Only include the sections that need to be generated
          sections: analysisData.sections?.filter((s: any) => missedSections.includes(s.section_id))
        };

        const inputType = body.input_type || 'document_analysis';
        const missedStructure = await callClaudeJSON<LearningStructure>(
          PROMPTS.generateStructure.system,
          PROMPTS.generateStructure.user(missedAnalysis, inputType),
          { temperature: 0.4, maxTokens: 32000 }
        );

        // Merge missed sections into structure
        if (missedStructure.content_sections) {
          structure.content_sections.push(...missedStructure.content_sections);
          console.log(`[generate-structure] ✅ Generated ${missedStructure.content_sections.length} new sections`);
        }
      }

      console.log(`[generate-structure] Final structure: ${structure.content_sections.length} sections (${cacheData.cachedSectionsCount} from cache, ${missedSections.length} generated)`);
      usedCache = true;

    } else {
      // No cache hits - generate everything with AI
      console.log('[generate-structure] No cache hits - generating full structure with AI...');

      const inputType = body.input_type || 'document_analysis';

      // Use higher token limit for complex documents with many problems/prerequisites
      // Each problem can generate 3-5 search queries, so this can get large
      // IMPORTANT: Need enough tokens for walkthrough units at the end of each problem
      // Claude Haiku 4.5 max output tokens: 64,000
      structure = await callClaudeJSON<LearningStructure>(
        PROMPTS.generateStructure.system,
        PROMPTS.generateStructure.user(analysisData, inputType),
        { temperature: 0.4, maxTokens: 64000 } // Maximum for Haiku 4.5 - ensures walkthrough units are generated
      );

      console.log('[generate-structure] Structure generated:');
      console.log(`  - Title: ${structure.summary?.title}`);
      console.log(`  - Prerequisites: ${structure.prerequisites_section?.learning_units?.length || 0}`);
      console.log(`  - Content sections: ${structure.content_sections?.length || 0}`);
    }

    // Flatten all search queries for easy access by search-resources
    const allSearchQueries = flattenSearchQueries(structure);
    console.log(`  - Total search queries: ${allSearchQueries.length}`);

    // Define subjectArea and equationResults for later use
    const subjectArea = analysisData?.subject_area || analysisData?.specific_topic || 'general';
    let equationResults = { totalCached: 0, totalNew: 0 };

    // Only generate embeddings and process equations if we generated NEW content
    // If everything came from cache, skip these steps (already done before)
    if (!usedCache) {
      // Generate embeddings for target resource profiles (NEW!)
      // This pre-computes embeddings and stores them in Pinecone
      console.log('[generate-structure] Pre-generating target resource embeddings...');
      await generateTargetResourceEmbeddings(structure, blueprint_id);

      // Process and cache equations from the structure
      console.log('[generate-structure] Processing equations for caching...');

      equationResults = await processStructureEquations(
        supabase,
        structure,
        blueprint_id,
        subjectArea,
        userId
      );

      console.log(`[generate-structure] Equations processed:`);
      console.log(`  - Cached (reused): ${equationResults.totalCached}`);
      console.log(`  - New (created): ${equationResults.totalNew}`);

      // Run aggressive equation detection for any units still missing equations
      const aggressiveResults = await detectAndAttachMissingEquations(
        supabase,
        structure,
        blueprint_id,
        subjectArea,
        userId
      );

      console.log(`[generate-structure] Aggressive detection added: ${aggressiveResults.addedCount} equations`);
    } else {
      console.log('[generate-structure] ⚡ Skipping embedding/equation generation - using cached data');
    }

    // Calculate metrics
    const metrics = countStructureMetrics(structure);

    // Process suggested figures
    const figureResults = await processSuggestedFigures(
      supabase,
      structure,
      blueprint_id,
      subjectArea,
      userId
    );

    console.log(`[generate-structure] Figures: ${figureResults.totalCached} cached, ${figureResults.totalNew} new`);

    // Store the learning structure in the database
    const insertData = {
      blueprint_id: blueprint_id,
      analysis_id: analysisId,
      document_id: documentId || null,
      user_id: userId,
      structure: structure,
      all_search_queries: allSearchQueries,
      total_prerequisites: metrics.total_prerequisites,
      total_sections: metrics.total_sections,
      total_learning_units: metrics.total_learning_units,
      total_search_queries: metrics.total_search_queries,
      model_used: 'claude-haiku-4-5',
    };

    console.log('[generate-structure] Storing learning structure in database...');

    const { data: newStructure, error: insertError } = await supabase
      .from('blueprint_structures')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[generate-structure] Database insert error:', insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log('[generate-structure] Structure saved with ID:', newStructure?.id);

    // =========================================================================
    // CACHE THIS NEW STRUCTURE FOR FUTURE USE
    // =========================================================================
    // Store this structure in the cache so similar documents can reuse it
    // This builds up a library of reusable learning structures over time
    // NOW: Cache each section individually (ONE ROW PER SECTION)
    // =========================================================================

    // Check if we should skip caching (if student provided personalized context)
    const shouldSkipCaching = !!(analysisData.student_context && analysisData.student_context.trim().length > 0);

    if (blueprint_id && analysisData && structure && !shouldSkipCaching) {
      // Only cache NEW sections (skip sections that came from cache)
      const cacheData = (analysisData as any);
      const cachedSectionIds = new Set(
        cacheData.cacheResults?.filter((r: any) => r.cache_hit).map((r: any) => r.section_id) || []
      );

      if (cachedSectionIds.size > 0) {
        console.log(`[generate-structure] Skipping ${cachedSectionIds.size} sections that came from cache (no duplicates)`);
      }

      // Filter to only NEW sections
      const newSections = analysisData.sections?.filter((s: any) => !cachedSectionIds.has(s.section_id)) || [];

      if (newSections.length > 0) {
        console.log(`[generate-structure] Caching ${newSections.length} NEW sections for future reuse...`);

        try {
          // Create a synthetic "prerequisites" section for embedding
          const prerequisitesSection = {
            section_id: 'prerequisites',
            section_type: 'topic',
            topic_summary: `Prerequisites: ${analysisData.prerequisites?.map((p: any) => p.concept || p).join(', ') || 'Foundation concepts'}`,
            concepts_tested: analysisData.prerequisites?.map((p: any) => p.concept || p) || []
          };

          // Generate embeddings for NEW sections + prerequisites
          const sectionsToEmbed = [...newSections];

          // Only add prerequisites if they exist and weren't cached
          if (structure.prerequisites_section?.learning_units && structure.prerequisites_section.learning_units.length > 0) {
            sectionsToEmbed.unshift(prerequisitesSection);
            console.log(`[generate-structure] Adding prerequisites section for embedding`);
          }

          const sectionsWithEmbeddings = await generateAllSectionEmbeddings({
            ...analysisData,
            sections: sectionsToEmbed
          });

          // Extract learning units from the generated structure (only NEW sections)
          const generatedUnits = new Map();

          // Add prerequisites as a special "section" if they exist
          if (structure.prerequisites_section?.learning_units && structure.prerequisites_section.learning_units.length > 0) {
            generatedUnits.set('prerequisites', structure.prerequisites_section.learning_units);
            console.log(`[generate-structure] Including ${structure.prerequisites_section.learning_units.length} prerequisite units for caching`);
          }

          // Add content sections
          if (structure.content_sections) {
            for (const contentSection of structure.content_sections) {
              // Only include if this section was NOT from cache
              if (!cachedSectionIds.has(contentSection.section_id) &&
                contentSection.learning_units &&
                contentSection.learning_units.length > 0) {
                generatedUnits.set(contentSection.section_id, contentSection.learning_units);
              }
            }
          }

          if (generatedUnits.size > 0) {
            // STEP 1: Store in Supabase FIRST to get cache IDs
            const sectionsToCache = prepareSectionsForCache(sectionsWithEmbeddings, generatedUnits);
            console.log(`[generate-structure] Caching ${sectionsToCache.length} NEW sections in Supabase...`);

            let supabaseCachedCount = 0;
            const supabaseCacheIds = new Map<string, string>(); // Map section_id -> Supabase row id

            for (const sectionToCache of sectionsToCache) {
              try {
                // Use the original section data attached to the cache object (more reliable)
                // Fallback to finding it in newSections if missing
                const originalSection = (sectionToCache as any).original_section ||
                  newSections.find((s: any) => s.section_id === sectionToCache.section_id);

                // VERIFY cached_unit contains COMPLETE data before storing
                const cachedUnit = sectionToCache.cached_unit;
                console.log(`[generate-structure] 💾 Storing section ${sectionToCache.section_id} to Supabase cache:`);

                if (cachedUnit?.units && Array.isArray(cachedUnit.units)) {
                  console.log(`[generate-structure]   - Multi-unit: ${cachedUnit.units.length} units`);
                  for (let i = 0; i < cachedUnit.units.length; i++) {
                    const unit = cachedUnit.units[i];
                    console.log(`[generate-structure]   Unit ${i + 1}: tutor_guidance=${unit.tutor_guidance ? '✓' : '✗'} (${unit.tutor_guidance?.length || 0} chars), target_resource_profile=${unit.target_resource_profile ? '✓' : '✗'}, equations=${unit.equations?.length || 0}`);
                  }
                } else if (cachedUnit?.topic) {
                  console.log(`[generate-structure]   - Single-unit: "${cachedUnit.topic}"`);
                  console.log(`[generate-structure]   - tutor_guidance: ${cachedUnit.tutor_guidance ? '✓' : '✗ MISSING!'} (${cachedUnit.tutor_guidance?.length || 0} chars)`);
                  console.log(`[generate-structure]   - target_resource_profile: ${cachedUnit.target_resource_profile ? '✓' : '✗ MISSING!'} (${cachedUnit.target_resource_profile?.length || 0} chars)`);
                  console.log(`[generate-structure]   - target_resource_embedding: ${cachedUnit.target_resource_embedding ? '✓' : '✗'} (${cachedUnit.target_resource_embedding?.length || 0} dims)`);
                  console.log(`[generate-structure]   - equations: ${cachedUnit.equations?.length || 0}`);
                  console.log(`[generate-structure]   - search_queries: ${cachedUnit.search_queries?.length || 0}`);
                }

                // Prepare cache entry for Supabase
                // CRITICAL: Store the COMPLETE cached_unit with ALL fields
                // Pinecone handles the vector search, Supabase stores the full cached_unit
                // NOTE: Only include columns that definitely exist in the table
                const cacheEntry: any = {
                  section_id: sectionToCache.section_id,
                  section_type: sectionToCache.section_type,
                  section_title: sectionToCache.cached_unit?.topic || sectionToCache.section_id,
                  embedding_source: sectionToCache.embedding_source,
                  cached_unit: sectionToCache.cached_unit, // COMPLETE learning unit data
                  concepts_tested: originalSection?.concepts_tested || [],
                  subject_area: analysisData.subject_area,
                  specific_topic: analysisData.specific_topic,
                  document_type: analysisData.document_type,
                  source_blueprint_id: blueprint_id, // CRITICAL: Links cache to source blueprint for unique identification
                  times_used: 0,
                  quality_score: 1.0
                };

                // Ensure embedding is 1536 dimensions for Supabase pgvector
                // If we got 3072 from Pinecone generation, we need to slice it
                // If it's 1536, we use it as is
                let embeddingForPostgres = sectionToCache.section_embedding;
                if (embeddingForPostgres && embeddingForPostgres.length > 1536) {
                  console.log(`[generate-structure] Truncating embedding from ${embeddingForPostgres.length} to 1536 dims for Postgres`);
                  embeddingForPostgres = embeddingForPostgres.slice(0, 1536);
                }

                // Format embedding for Postgres vector column (if present)
                const primaryEmbeddingStr = embeddingForPostgres
                  ? formatVectorForPostgres(embeddingForPostgres)
                  : null;

                // Add type-specific fields
                // FIX: Add embeddings to satisfy database constraints (check_problem_fields, check_topic_fields)
                // Even though we use Pinecone, Supabase schema requires these non-null
                // Must use formatVectorForPostgres to convert array to vector string
                cacheEntry.primary_embedding = primaryEmbeddingStr;

                if (sectionToCache.section_type === 'problem') {
                  // For problems, originalSection is required for problem_statement
                  cacheEntry.problem_statement_text = originalSection?.problem_statement || "Problem statement missing";
                  cacheEntry.problem_statement_embedding = primaryEmbeddingStr;

                  if (!originalSection) {
                    console.warn(`[generate-structure] ⚠️ Warning: Original section data missing for problem ${sectionToCache.section_id}`);
                  }
                } else if (sectionToCache.section_type === 'topic') {
                  // For topics, originalSection is required for topic_summary
                  cacheEntry.topic_summary_text = originalSection?.topic_summary || "Topic summary missing";
                  cacheEntry.topic_summary_embedding = primaryEmbeddingStr;
                }

                // Insert into Supabase (include embeddings to satisfy constraints)
                const { error, data } = await supabase
                  .from('cached_blueprint_structures')
                  .insert([cacheEntry])
                  .select('id')
                  .single();

                if (error) {
                  console.error(`[generate-structure] ❌ Error caching section in Supabase ${sectionToCache.section_id}:`, error);
                  console.error(`[generate-structure]   Error details:`, JSON.stringify(error));
                } else {
                  const cacheId = data?.id;
                  console.log(`[generate-structure] ✅ Successfully cached section ${sectionToCache.section_id} with COMPLETE data (ID: ${cacheId})`);
                  supabaseCachedCount++;

                  // Store the cache ID for Pinecone linking
                  if (cacheId) {
                    supabaseCacheIds.set(sectionToCache.section_id, cacheId);
                  }
                }
              } catch (err) {
                console.error(`[generate-structure] ❌ Exception caching section ${sectionToCache.section_id}:`, err);
              }
            }

            console.log(`[generate-structure] Successfully cached in Supabase: ${supabaseCachedCount}/${sectionsToCache.length} NEW sections`);

            // STEP 2: Store in Pinecone with cache IDs linking back to Supabase
            console.log(`[generate-structure] Storing ${generatedUnits.size} NEW sections in Pinecone with cache IDs...`);
            const pineconeResult = await storeSectionsInPinecone(
              sectionsWithEmbeddings,
              generatedUnits,
              blueprint_id,
              supabaseCacheIds // Pass the Supabase row IDs for linking
            );

            console.log(`[generate-structure] Successfully cached in Pinecone: ${pineconeResult.stored}/${sectionsToCache.length} NEW sections`);
          } else {
            console.log('[generate-structure] No new sections to cache (all sections were from cache or none generated)');
          }
        } catch (err) {
          console.error('[generate-structure] Error in section caching:', err);
          // Don't fail the whole operation if caching fails
        }
      } else {
        console.log('[generate-structure] All sections came from cache - no new sections to store');
      }
    }

    // Update blueprint status to indicate structure generation is complete
    if (blueprint_id) {
      await supabase
        .from('blueprints')
        .update({ generation_status: 'structure_generated' })
        .eq('id', blueprint_id);
    }

    console.log('[generate-structure] Complete!');

    return new Response(
      JSON.stringify({
        success: true,
        step: 'generate_structure',
        status: 'structure_generated',
        structure_id: newStructure?.id,
        structure: structure,
        metrics: metrics,
        search_queries_count: allSearchQueries.length,
        equations: {
          cached: equationResults.totalCached,
          new: equationResults.totalNew,
          total: equationResults.totalCached + equationResults.totalNew,
        },
        message: `Learning structure generated with ${allSearchQueries.length} search queries and ${equationResults.totalCached + equationResults.totalNew} equations. Ready for Step 3 (Search Resources).`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[generate-structure] Error:', error);

    // Update blueprint with error status
    if (blueprint_id) {
      try {
        await supabase
          .from('blueprints')
          .update({
            generation_status: 'failed',
            generation_error: error?.message || 'Structure generation failed',
          })
          .eq('id', blueprint_id);
      } catch (updateError) {
        console.error('[generate-structure] Failed to update error status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

