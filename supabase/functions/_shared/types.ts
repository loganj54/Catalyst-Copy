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

// 19. check-structure-cache
export interface CheckStructureCacheInput {
  analysis: AnalysisResult;
  threshold: number;
}

export interface CheckStructureCacheOutput {
  cache_hit: boolean;
  cached_structure?: LearningStructure;
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

// 25. cache-structure
export interface CacheStructureInput {
  structure: LearningStructure;
  analysis: AnalysisResult;
  analysis_id: string;
}

export interface CacheStructureOutput {
  cache_id: string;
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
  sections?: any[];
  problems?: any[];
  prerequisites?: any[];
  key_equations?: any[];
  study_recommendations?: any;
}

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

export interface ContentSection {
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

export interface LearningUnit {
  unit_id: string;
  unit_type: 'prerequisite' | 'topic' | 'walkthrough';
  topic: string;
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

