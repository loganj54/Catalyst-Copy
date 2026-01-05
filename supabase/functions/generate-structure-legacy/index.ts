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
import { generateEmbedding } from '../_shared/embeddings.ts';
// NEW: Use section-level caching utilities
import { 
  generateAllSectionEmbeddings,
  prepareSectionsForCache 
} from '../_shared/section-embeddings.ts';
import {
  findOrCreateFigure,
} from '../_shared/figure-sourcing.ts';

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
 * Embeddings are stored directly in each learning unit in the structure
 */
async function generateTargetResourceEmbeddings(structure: LearningStructure): Promise<void> {
  let totalUnits = 0;
  let successCount = 0;
  let failCount = 0;
  
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
        
        // Store embedding directly in the unit
        unit.target_resource_embedding = result.embedding;
        
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
          
          // Store embedding directly in the unit
          unit.target_resource_embedding = result.embedding;
          
          successCount++;
        } catch (error) {
          console.error(`[generate-structure] Failed to generate embedding for unit "${unit.topic}":`, error);
          failCount++;
        }
      }
    }
  }
  
  console.log(`[generate-structure] Target resource embedding generation complete:`);
  console.log(`  - Total units: ${totalUnits}`);
  console.log(`  - Success: ${successCount}`);
  console.log(`  - Failed: ${failCount}`);
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
      const result = await generateEmbedding(embeddingText);
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
      // =========================================================================
      
      console.log('[generate-structure] ========================================');
      console.log('[generate-structure] CHECKING SECTION-LEVEL CACHE');
      console.log('[generate-structure] ========================================');
      
      // NEW: Check cache for each section individually
      const sectionsWithEmbeddings = await generateAllSectionEmbeddings(analysisData);
      console.log(`[generate-structure] Generated embeddings for ${sectionsWithEmbeddings.length} sections`);
      
      // Check cache for each section
      const cacheResults = [];
      let cachedSectionsCount = 0;
      
      for (const sectionWithEmbedding of sectionsWithEmbeddings) {
        const { data, error } = await supabase.rpc('search_similar_sections', {
          query_embedding: sectionWithEmbedding.embedding,
          p_section_type: sectionWithEmbedding.section_type,
          p_subject_area: analysisData.subject_area,
          p_document_type: analysisData.document_type,
          similarity_threshold: 0.95,
          max_results: 1
        });
        
        if (!error && data && data.length > 0) {
          const cached = data[0];
          console.log(`[generate-structure] ✅ CACHE HIT for ${sectionWithEmbedding.section_id}! Similarity: ${(cached.similarity * 100).toFixed(1)}%`);
          cacheResults.push({
            section_id: sectionWithEmbedding.section_id,
            cache_hit: true,
            cached_unit: cached.cached_unit,
            similarity: cached.similarity
          });
          cachedSectionsCount++;
          
          // Increment usage
          await supabase.rpc('increment_section_cache_usage', { cache_id: cached.id });
        } else {
          console.log(`[generate-structure] ❌ CACHE MISS for ${sectionWithEmbedding.section_id}`);
          cacheResults.push({
            section_id: sectionWithEmbedding.section_id,
            cache_hit: false
          });
        }
      }
      
      const cacheHitRate = sectionsWithEmbeddings.length > 0 ? cachedSectionsCount / sectionsWithEmbeddings.length : 0;
      console.log(`[generate-structure] Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}% (${cachedSectionsCount}/${sectionsWithEmbeddings.length} sections)`);
      
      // For now, if we have ANY cache hits, we'll still generate the full structure
      // but we could optimize this later to only generate cache-missed sections
      if (cachedSectionsCount > 0) {
        console.log('[generate-structure] ⚠️  Some sections cached, but generating full structure for consistency');
        console.log(`[generate-structure]   - Token savings estimate: ~${cachedSectionsCount * 1000} tokens`);
        console.log('[generate-structure]   - Future optimization: Use cached sections directly');
        // Fall through to generate full structure below
      }
      
      console.log('[generate-structure] Generating structure with AI...');

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

    // Call Claude to generate the learning structure
    console.log('[generate-structure] Calling Claude to generate learning structure...');
    
    const inputType = body.input_type || 'document_analysis';
    
    // Use higher token limit for complex documents with many problems/prerequisites
    // Each problem can generate 3-5 search queries, so this can get large
    // IMPORTANT: Need enough tokens for walkthrough units at the end of each problem
    // Claude Haiku 4.5 max output tokens: 64,000
    const structure = await callClaudeJSON<LearningStructure>(
      PROMPTS.generateStructure.system,
      PROMPTS.generateStructure.user(analysisData, inputType),
      { temperature: 0.4, maxTokens: 64000 } // Maximum for Haiku 4.5 - ensures walkthrough units are generated
    );

    console.log('[generate-structure] Structure generated:');
    console.log(`  - Title: ${structure.summary?.title}`);
    console.log(`  - Prerequisites: ${structure.prerequisites_section?.learning_units?.length || 0}`);
    console.log(`  - Content sections: ${structure.content_sections?.length || 0}`);

    // Flatten all search queries for easy access by search-resources
    const allSearchQueries = flattenSearchQueries(structure);
    console.log(`  - Total search queries: ${allSearchQueries.length}`);

    // Generate embeddings for target resource profiles (NEW!)
    // This pre-computes embeddings to avoid redundant generation during search phase
    console.log('[generate-structure] Pre-generating target resource embeddings...');
    await generateTargetResourceEmbeddings(structure);

    // Calculate metrics
    const metrics = countStructureMetrics(structure);

    // Process and cache equations from the structure
    const subjectArea = analysisData?.subject_area || analysisData?.specific_topic || 'general';
    console.log('[generate-structure] Processing equations for caching...');
    
    const equationResults = await processStructureEquations(
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
    
    if (blueprint_id && analysisData && structure) {
      console.log('[generate-structure] Caching sections individually for future reuse...');
      
      try {
        // Generate embeddings for all sections
        const sectionsWithEmbeddings = await generateAllSectionEmbeddings(analysisData);
        
        // Extract learning units from the generated structure
        const generatedUnits = new Map();
        
        // Map content sections to their learning units
        if (structure.content_sections) {
          for (const contentSection of structure.content_sections) {
            if (contentSection.learning_units && contentSection.learning_units.length > 0) {
              generatedUnits.set(contentSection.section_id, contentSection.learning_units);
            }
          }
        }
        
        // Prepare sections for cache
        const sectionsToCache = prepareSectionsForCache(sectionsWithEmbeddings, generatedUnits);
        
        console.log(`[generate-structure] Caching ${sectionsToCache.length} sections...`);
        
        // Cache each section individually
        let cachedCount = 0;
        for (const sectionToCache of sectionsToCache) {
          try {
            // Get original section data
            const originalSection = analysisData.sections?.find((s: any) => s.section_id === sectionToCache.section_id);
            
            // Prepare cache entry
            const cacheEntry: any = {
              section_id: sectionToCache.section_id,
              section_type: sectionToCache.section_type,
              section_title: sectionToCache.cached_unit?.topic || sectionToCache.section_id,
              primary_embedding: sectionToCache.section_embedding,
              embedding_source: sectionToCache.embedding_source,
              cached_unit: sectionToCache.cached_unit,
              concepts_tested: originalSection?.concepts_tested || [],
              subject_area: analysisData.subject_area,
              specific_topic: analysisData.specific_topic,
              document_type: analysisData.document_type,
              course_level: analysisData.course_level,
              times_used: 0,
              quality_score: 1.0,
              source_analysis_id: analysisId
            };
            
            // Add type-specific fields
            if (sectionToCache.section_type === 'problem' && originalSection) {
              cacheEntry.problem_statement_text = originalSection.problem_statement || null;
              cacheEntry.problem_statement_embedding = sectionToCache.section_embedding;
            } else if (sectionToCache.section_type === 'topic' && originalSection) {
              cacheEntry.topic_summary_text = originalSection.topic_summary || null;
              cacheEntry.topic_summary_embedding = sectionToCache.section_embedding;
            }
            
            // Insert into database
            const { error } = await supabase
              .from('cached_blueprint_structures')
              .insert([cacheEntry]);
            
            if (error) {
              console.error(`[generate-structure] Error caching section ${sectionToCache.section_id}:`, error);
            } else {
              cachedCount++;
              console.log(`[generate-structure] ✅ Cached section: ${sectionToCache.section_id}`);
            }
          } catch (err) {
            console.error(`[generate-structure] Error caching section ${sectionToCache.section_id}:`, err);
          }
        }
        
        console.log(`[generate-structure] Successfully cached ${cachedCount}/${sectionsToCache.length} sections`);
      } catch (err) {
        console.error('[generate-structure] Error in section caching:', err);
        // Don't fail the whole operation if caching fails
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

