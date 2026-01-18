// ============================================================================
// SHARED TYPES FOR MODULAR FUNCTION ARCHITECTURE
// ============================================================================
// Defines all TypeScript interfaces for the 26 atomic functions + orchestrators
// ============================================================================

// ============================================================================
// SELF-HEALING SYSTEM TYPES
// ============================================================================

export type HealingMode = 'development' | 'production';

export interface SelfHealingConfig {
  enabled: boolean;
  mode: HealingMode;
  last_toggled: string;
  snapshot_hash: string | null;
}

export interface ErrorContext {
  function_name: string;
  error_id?: string;
  error_message: string;
  error_stack: string;
  input_data: any;
  timestamp: string;
  environment?: Record<string, any>;
}

export interface HealingResult {
  success: boolean;
  directives_updated: boolean;
  code_updated: boolean;
  new_directives?: string;
  new_code?: string;
  fix_description: string;
  git_commit_hash?: string;
}

export interface DirectiveSnapshot {
  function_name: string;
  file_path: string;
  content: string;
  hash: string;
}

// ============================================================================
// SEARCH RESOURCE FUNCTION TYPES
// ============================================================================

// 1. generate-embedding
export interface GenerateEmbeddingInput {
  text: string;
}

export interface GenerateEmbeddingOutput {
  embedding: number[];
  model: string;
  metadata?: {
    timestamp: string;
    text_length: number;
  };
}

// 2. search-db-cache
export interface SearchDbCacheInput {
  embedding: number[];
  threshold: number;
  max_results: number;
}

export interface SearchDbCacheOutput {
  resources: Resource[];
  cache_hit: boolean;
  similarity_scores: number[];
  metadata?: {
    search_time_ms: number;
    total_matches: number;
  };
}

// 3. search-youtube
export interface SearchYoutubeInput {
  queries: string[];
  max_results: number;
  filters?: {
    language?: string;
    duration?: 'short' | 'medium' | 'long';
  };
}

export interface SearchYoutubeOutput {
  resources: Resource[];
  queries_used: string[];
  total_found: number;
  metadata?: {
    api_quota_used: number;
  };
}

// 4. search-grok
export interface SearchGrokInput {
  queries: string[];
  topic: string;
  max_results: number;
}

export interface SearchGrokOutput {
  resources: Resource[];
  queries_used: string[];
  metadata?: {
    search_time_ms: number;
    grok_model: string;
  };
}

// 5. search-claude-web
export interface SearchClaudeWebInput {
  queries: string[];
  topic: string;
  max_results: number;
  description?: string;
}

export interface SearchClaudeWebOutput {
  resources: Resource[];
  queries_used: string[];
  metadata?: {
    search_time_ms: number;
    tool_uses: number;
  };
}

// 6. analyze-transcript
export interface AnalyzeTranscriptInput {
  video_url: string;
  metadata?: VideoMetadata;
}

export interface AnalyzeTranscriptOutput {
  transcript: string;
  analysis: ContentAnalysis;
  confidence: number;
  transcript_source: 'auto_generated' | 'manual' | 'metadata_only' | 'failed';
}

// 7. store-resource
export interface StoreResourceInput {
  resource: Resource;
  embedding: number[];
  user_id?: string;
}

export interface StoreResourceOutput {
  resource_id: string;
  created: boolean; // true if new, false if updated existing
  metadata?: {
    stored_at: string;
  };
}

// 8. link-resource-to-blueprint
export interface LinkResourceToBlueprintInput {
  blueprint_id: string;
  unit_id: string;
  resource_id: string;
  relevance: number;
  query_type?: string;
  resource_explanation?: string;
}

export interface LinkResourceToBlueprintOutput {
  success: boolean;
  link_id: string;
  metadata?: {
    linked_at: string;
  };
}

// 9. generate-resource-explanations
export interface GenerateResourceExplanationsInput {
  topic: string;
  resources: Resource[];
  learning_objective?: string;
  description?: string;
}

export interface GenerateResourceExplanationsOutput {
  resources_with_explanations: Resource[];
  filtered_count: number;
  metadata?: {
    explanations_generated: number;
    model_used: string;
  };
}

// 10. orchestrate-search-resources
export interface OrchestrateSearchResourcesInput {
  blueprint_id: string;
  unit_id: string;
  topic: string;
  search_queries: SearchQuery[];
  description?: string;
  learning_objective?: string;
  semantic_search_phrase?: string;
  target_resource_profile?: string; // Description of the ideal resource for this unit
  target_resource_embedding?: number[]; // Pre-computed embedding (1536 dimensions) of the target resource profile
}

export interface OrchestrateSearchResourcesOutput {
  resources: Resource[];
  cache_hit: boolean;
  search_method: 'cache' | 'youtube_api' | 'grok' | 'claude_web_search';
  metadata?: {
    total_time_ms: number;
    steps_completed: string[];
  };
}

// ============================================================================
// DOCUMENT ANALYSIS FUNCTION TYPES
// ============================================================================

// 11. fetch-document
export interface FetchDocumentInput {
  file_url: string;
  bucket?: string;
  path?: string;
}

export interface FetchDocumentOutput {
  content: ArrayBuffer | string;
  content_type: string;
  metadata?: {
    file_size_bytes: number;
    fetch_time_ms: number;
  };
}

// 12. parse-pdf-to-base64
export interface ParsePdfToBase64Input {
  pdf_buffer: ArrayBuffer;
}

export interface ParsePdfToBase64Output {
  base64: string;
  size_mb: number;
  metadata?: {
    parse_time_ms: number;
  };
}

// 13. analyze-with-claude
export interface AnalyzeWithClaudeInput {
  pdf_base64?: string;
  text?: string;
  task_type: string;
}

export interface AnalyzeWithClaudeOutput {
  analysis: AnalysisResult;
  model: string;
  metadata?: {
    tokens_used: number;
    analysis_time_ms: number;
  };
}

// 14. store-analysis
export interface StoreAnalysisInput {
  analysis: AnalysisResult;
  document_id: string;
  user_id: string;
  blueprint_id?: string;
  class_id?: string;
  source_filename?: string;
  source_type?: 'pdf' | 'text' | 'both';
}

export interface StoreAnalysisOutput {
  analysis_id: string;
  metadata?: {
    stored_at: string;
  };
}

// 15. generate-blueprint-name
export interface GenerateBlueprintNameInput {
  analysis: AnalysisResult;
  current_title: string;
}

export interface GenerateBlueprintNameOutput {
  blueprint_name: string;
  suggested_class: string | null;
  confidence: number;
  reasoning: string;
}

// 16. check-existing-analysis
export interface CheckExistingAnalysisInput {
  document_id: string;
}

export interface CheckExistingAnalysisOutput {
  exists: boolean;
  analysis_id?: string;
  analysis?: AnalysisResult;
  metadata?: {
    created_at?: string;
  };
}

// 17. orchestrate-analyze-document
export interface OrchestrateAnalyzeDocumentInput {
  blueprint_id: string;
  force_reanalyze?: boolean;
}

export interface OrchestrateAnalyzeDocumentOutput {
  analysis: AnalysisResult;
  analysis_id: string;
  reused: boolean;
  metadata?: {
    total_time_ms: number;
    steps_completed: string[];
  };
}

// ============================================================================
// STRUCTURE GENERATION FUNCTION TYPES
// ============================================================================

// 18. fetch-analysis
export interface FetchAnalysisInput {
  blueprint_id?: string;
  document_id?: string;
}

export interface FetchAnalysisOutput {
  analysis: AnalysisResult;
  analysis_id: string;
  metadata?: {
    fetch_time_ms: number;
  };
}

// 19. check-structure-cache (UPDATED FOR SECTION-LEVEL CACHING)
export interface CheckStructureCacheInput {
  analysis: AnalysisResult;
  threshold: number;
  sections_with_embeddings: SectionWithEmbedding[];
}

export interface SectionWithEmbedding {
  section_id: string;
  section_type: 'problem' | 'topic';
  embedding: number[];
  embedding_source: string;
  section_data: AnalysisSection; // The original section from analysis
}

export interface CheckStructureCacheOutput {
  cache_results: SectionCacheResult[];
  overall_cache_hit_rate: number;
  total_sections: number;
  cached_sections: number;
  generated_sections: number;
}

export interface SectionCacheResult {
  section_id: string;
  section_type: 'problem' | 'topic';
  cache_hit: boolean;
  cached_unit?: LearningUnit;
  similarity?: number;
  cache_id?: string;
  times_used?: number;
  quality_score?: number;
}

// 20. adapt-cached-structure
export interface AdaptCachedStructureInput {
  cached_structure: LearningStructure;
  new_analysis: AnalysisResult;
}

export interface AdaptCachedStructureOutput {
  adapted_structure: LearningStructure;
  metadata?: {
    adaptation_time_ms: number;
    changes_made: string[];
  };
}

// 21. generate-structure-with-ai
export interface GenerateStructureWithAiInput {
  analysis: AnalysisResult;
  input_type?: string;
}

export interface GenerateStructureWithAiOutput {
  structure: LearningStructure;
  model: string;
  metadata?: {
    tokens_used: number;
    generation_time_ms: number;
  };
}

// 21b. generate-structure-mixed (NEW - for partial generation)
export interface GenerateStructureMixedInput {
  analysis: AnalysisResult;
  cache_results: SectionCacheResult[];
  sections_to_generate: string[]; // Array of section IDs that need generation
}

export interface GenerateStructureMixedOutput {
  generated_units: GeneratedUnitMap;
  model: string;
  metadata?: {
    tokens_used: number;
    generation_time_ms: number;
    sections_generated: number;
  };
}

export interface GeneratedUnitMap {
  [section_id: string]: LearningUnit[];
}

// 22. process-equations
export interface ProcessEquationsInput {
  structure: LearningStructure;
  subject_area: string;
  blueprint_id: string;
  user_id: string;
}

export interface ProcessEquationsOutput {
  cached_count: number;
  new_count: number;
  total: number;
  metadata?: {
    processing_time_ms: number;
  };
}

// 23. source-figures
export interface SourceFiguresInput {
  structure: LearningStructure;
  subject_area: string;
  blueprint_id: string;
  user_id: string;
}

export interface SourceFiguresOutput {
  cached_count: number;
  new_count: number;
  total: number;
  metadata?: {
    processing_time_ms: number;
    wikimedia_searches: number;
  };
}

// 24. store-structure
export interface StoreStructureInput {
  structure: LearningStructure;
  blueprint_id: string;
  analysis_id: string;
  document_id?: string;
  user_id: string;
  from_cache?: boolean;
  cache_source_id?: string;
}

export interface StoreStructureOutput {
  structure_id: string;
  metadata?: {
    stored_at: string;
  };
}

// 25. cache-structure (UPDATED FOR SECTION-LEVEL CACHING)
export interface CacheStructureInput {
  sections_to_cache: SectionToCache[];
  analysis: AnalysisResult;
  analysis_id: string;
}

export interface SectionToCache {
  section_id: string;
  section_type: 'problem' | 'topic';
  section_embedding: number[];
  embedding_source: string;
  cached_unit: LearningUnit | { units: LearningUnit[]; primary_unit: LearningUnit };
  original_section?: AnalysisSection; // Original section data from analysis
}

export interface CacheStructureOutput {
  cached_sections: number;
  cache_ids: string[];
  metadata?: {
    cached_at: string;
  };
}

// 26. orchestrate-generate-structure
export interface OrchestrateGenerateStructureInput {
  blueprint_id: string;
}

export interface OrchestrateGenerateStructureOutput {
  structure: LearningStructure;
  structure_id: string;
  from_cache: boolean;
  metadata?: {
    total_time_ms: number;
    steps_completed: string[];
    token_savings?: string;
  };
}

// ============================================================================
// SHARED DOMAIN TYPES
// ============================================================================

export interface Resource {
  id?: string;
  url: string;
  title: string;
  description: string;
  platform: string;
  channel_name?: string;
  channel_url?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  topic_signature: string;
  concepts_covered: string[];
  difficulty_level: string;
  quality_score: number;
  similarity?: number;
  from_cache: boolean;
  query_type?: string;
  query_used?: string;
  transcript_analyzed?: boolean;
  transcript_source?: 'auto_generated' | 'manual' | 'metadata_only' | 'failed' | 'none';
  content_analysis?: ContentAnalysis;
  analysis_confidence?: number;
  resource_explanation?: string;
}

export interface VideoMetadata {
  title?: string;
  description?: string;
  channelName?: string;
  duration_seconds?: number;
}

export interface ContentAnalysis {
  concepts_taught: string[];
  difficulty_assessment: string;
  key_topics: string[];
  prerequisites?: string[];
  quality_indicators?: string[];
}

export interface SearchQuery {
  query: string;
  query_type: 'introduction' | 'concept' | 'tutorial' | 'example' | 'practice';
  target_content: string;
  priority: number;
}

export interface AnalysisResult {
  document_type: 'problem_set' | 'lecture' | 'hybrid' | 'textbook' | 'study_guide';
  subject_area: string;
  specific_topic: string;
  course_level: 'introductory' | 'intermediate' | 'advanced' | 'graduate';
  content_classification?: any;
  sections?: AnalysisSection[];
  problems?: any[];
  prerequisites?: any[];
  key_equations?: any[];
  study_recommendations?: any;
}

export interface AnalysisSection {
  section_id: string;
  section_type: 'problem' | 'topic';
  // For problems
  problem_statement?: string;
  figure_description?: string;
  given_variables?: any[];
  unknown_variables?: any[];
  assumptions?: string[];
  solving_approach?: string[];
  // For topics
  topic_summary?: string;
  key_concepts?: string[];
  learning_objectives?: string[];
  // Common fields
  concepts_tested: string[];
  equations_needed?: string[];
  difficulty?: number;
  estimated_minutes?: number;
  common_mistakes?: string[];
}

/**
 * Learning Structure Hierarchy:
 * 
 * LEVEL 1 - SECTION LEVEL (appears as tabs in UI):
 *   - Prerequisites (optional)
 *   - Problem 1, Problem 2, Problem 3... (for homework/problem_set documents)
 *   - Topic 1, Topic 2, Topic 3... (for lecture documents)
 * 
 * LEVEL 2 - CONCEPT LEVEL (appears as dropdown items in UI):
 *   - Individual concepts within each section
 *   - Represented as LearningUnit objects in the learning_units array
 *   - Each concept has: tutor_guidance, target_resource_profile, equations, figures, search_queries
 * 
 * Example for Homework:
 *   Problem 1 (section) → [Force Analysis (concept), Energy Conservation (concept), Walkthrough (concept)]
 * 
 * Example for Lecture:
 *   Topic 1 (section) → [Newton's Laws (concept), Free Body Diagrams (concept), Force Analysis (concept)]
 */
export interface LearningStructure {
  summary: {
    title: string;
    description: string;
    total_estimated_time_minutes: number;
    difficulty_progression: string;
  };
  prerequisites_section: PrerequisitesSection;
  content_sections: ContentSection[];
}

export interface PrerequisitesSection {
  description: string;
  learning_units: LearningUnit[];
}

/**
 * ContentSection represents a SECTION (Level 1 in hierarchy)
 * - For homework: This is a "Problem" (e.g., "Problem 1", "Problem 2")
 * - For lectures: This is a "Topic" (e.g., "Topic 1", "Topic 2")
 * - Contains multiple learning_units (concepts) that appear as dropdown items
 */
export interface ContentSection {
  section_id: string;
  section_type: 'problem' | 'topic' | 'chapter';
  title: string;
  description: string;
  concepts: string[];
  learning_units: LearningUnit[]; // CONCEPT LEVEL - each unit is a dropdown item in UI
  problem_details?: {
    original_problem_id: string;
    key_equations: string[];
    common_mistakes: string[];
  };
}

/**
 * LearningUnit represents a CONCEPT (Level 2 in hierarchy)
 * - This is what appears as a dropdown item in the UI
 * - For homework: Individual concepts like "Force Analysis", "Energy Conservation"
 * - For lectures: Individual concepts like "Newton's Laws", "Free Body Diagrams"
 * - Each concept has full structure: tutor_guidance, target_resource_profile, equations, figures, search queries
 */
export interface LearningUnit {
  unit_id: string;
  unit_type: 'prerequisite' | 'topic' | 'walkthrough';
  topic: string; // The concept name (e.g., "Newton's Second Law", "Force Analysis")
  description?: string;
  learning_objective?: string;
  tutor_guidance: string;
  category?: string;
  difficulty?: string;
  priority?: string;
  estimated_time_minutes: number;
  equations?: Equation[];
  suggested_figures?: SuggestedFigure[];
  search_queries: SearchQuery[];
  problem_solving_queries?: SearchQuery[];
  semantic_search_phrase?: string;
  /** 
   * When this unit requires looking up data from reference materials (steam tables, 
   * Moody diagram, beam properties, etc.), this names the resource. Students are 
   * encouraged to use their own class materials to practice for exams.
   * Example: "Moody Diagram" or "Steam Tables (Appendix A)"
   */
  data_gathering_resource?: string;
}

export interface Equation {
  index: number;
  name: string;
  latex: string;
  variables: Record<string, string>;
  when_to_use: string;
}

export interface SuggestedFigure {
  name: string;
  figure_type: 'diagram' | 'chart' | 'graph' | 'table' | 'illustration';
  description: string;
  search_terms: string[];
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface FunctionError {
  error: string;
  code: string;
  details?: any;
  timestamp?: string;
  function_name?: string;
}

export const ErrorCodes = {
  // Input validation
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  EMPTY_INPUT: 'EMPTY_INPUT',

  // API errors
  API_ERROR: 'API_ERROR',
  MISSING_API_KEY: 'MISSING_API_KEY',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',

  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  MEMORY_ERROR: 'MEMORY_ERROR',
  INTEGRITY_ERROR: 'INTEGRITY_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

