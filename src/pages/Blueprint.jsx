import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, BookOpen, Target, Calendar, FileText, Loader2, Download, 
  ExternalLink, RefreshCw, AlertCircle, Sparkles, ChevronDown, ChevronUp, 
  ChevronRight, Bug, Check, Play, Youtube, Clock, Star, Zap, HelpCircle,
  Layout, Grid, Circle, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import EquationDisplay from '../components/EquationDisplay';
import FigureDisplay from '../components/FigureDisplay';
import Sidebar from '../components/Sidebar';
import ClassSidebar from '../components/ClassSidebar';

// Generation status display configuration
const STATUS_CONFIG = {
  pending: { 
    label: 'Waiting to start...', 
    icon: Loader2, 
    color: 'text-stone-500',
    animate: false 
  },
  analyzing: { 
    label: 'Analyzing your document...', 
    icon: Sparkles, 
    color: 'text-blue-500',
    animate: true 
  },
  analyzed: { 
    label: 'Analysis complete - ready for structure generation', 
    icon: Sparkles, 
    color: 'text-blue-500',
    animate: false 
  },
  searching: { 
    label: 'Finding the best resources...', 
    icon: Sparkles, 
    color: 'text-purple-500',
    animate: true 
  },
  generating: { 
    label: 'Building your learning path...', 
    icon: Sparkles, 
    color: 'text-orange-500',
    animate: true 
  },
  structure_complete: { 
    label: 'Structure generated - ready for resource search', 
    icon: Sparkles, 
    color: 'text-orange-500',
    animate: false 
  },
  completed: { 
    label: 'Complete!', 
    icon: Sparkles, 
    color: 'text-green-500',
    animate: false 
  },
  failed: { 
    label: 'Generation failed', 
    icon: AlertCircle, 
    color: 'text-red-500',
    animate: false 
  },
};

// ============================================================================
// RESOURCE TABLE COMPONENT
// ============================================================================
const ResourceTable = ({ resources }) => {
  const getPlatformIcon = (platform) => {
    if (platform?.toLowerCase().includes('youtube')) {
      return <Youtube className="w-4 h-4 text-red-500" />;
    }
    return <ExternalLink className="w-4 h-4 text-stone-400" />;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Decode HTML entities in text
  const decodeHtmlEntities = (text) => {
    if (!text) return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };

  if (!resources || resources.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-stone-300 dark:border-stone-600">
      <table className="min-w-full divide-y divide-stone-200 dark:divide-stone-700">
        <thead className="bg-stone-50 dark:bg-stone-900">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider w-1/3">
              Resource
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Summary
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-stone-800 divide-y divide-stone-200 dark:divide-stone-700">
          {resources.map((resource, idx) => (
            <tr key={resource.id || idx} className="hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors">
              <td className="px-6 py-4">
                <a 
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 group"
                >
                  {/* Thumbnail */}
                  <div className="relative w-24 h-16 rounded-md overflow-hidden bg-stone-200 shrink-0">
                    {resource.thumbnail_url ? (
                      <img 
                        src={resource.thumbnail_url} 
                        alt={resource.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-100">
                        <Play className="w-6 h-6 text-stone-400" />
                      </div>
                    )}
                    {resource.duration_seconds && (
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 text-white text-[10px] rounded">
                        {formatDuration(resource.duration_seconds)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900 dark:text-stone-100 group-hover:text-[#FF4A1C] dark:group-hover:text-[#FF4A1C] line-clamp-2">
                      {decodeHtmlEntities(resource.title)}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-stone-500 dark:text-stone-400">
                      {getPlatformIcon(resource.platform)}
                      <span>{decodeHtmlEntities(resource.channel_name) || resource.platform}</span>
                    </div>
                  </div>
                </a>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-stone-600 dark:text-stone-300">
                  {resource.resource_explanation ? (
                    <span>
                      <span className="italic text-[#FF4A1C] dark:text-[#FF4A1C]">Why this helps: </span>
                      {decodeHtmlEntities(resource.resource_explanation)}
                    </span>
                  ) : (
                    decodeHtmlEntities(resource.description) || 'No description available.'
                  )}
                </div>
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {resource.from_cache && (
                    <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                      <Star className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// TOPIC LIST ITEM COMPONENT
// ============================================================================
const TopicListItem = ({ 
  unit, 
  blueprintId, 
  topicResponse, 
  topicResources,
  topicEquations,
  topicFigures,
  onComfortSelect,
  onGenerateBlueprint,
  isSearching,
  isExpanded,
  onToggle
}) => {
  const hasResources = topicResources && topicResources.length > 0;
  const isComfortable = topicResponse?.response === 'comfortable';
  const isWalkthrough = unit.unit_type === 'walkthrough';
  
  // Use equations from database if available, fallback to structure data
  const equations = topicEquations && topicEquations.length > 0 
    ? topicEquations 
    : unit.equations;

  return (
    <div className={`border-b border-stone-200 dark:border-stone-700 last:border-0 transition-colors ${isExpanded ? 'bg-stone-50/50 dark:bg-stone-800/50' : 'hover:bg-stone-50/30 dark:hover:bg-stone-800/30'}`}>
      <div 
        onClick={onToggle}
        className="w-full text-left py-4 px-4 flex items-start gap-3 cursor-pointer group select-none"
      >
        <div className="mt-1 text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors">
           {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </div>
        
        <div className="flex-1 min-w-0">
           <div className="flex items-center gap-3">
              <h4 className={`font-semibold text-lg ${isWalkthrough ? 'text-stone-900 dark:text-stone-100' : 'text-[#2A2B2A] dark:text-stone-100'}`}>
                {unit.topic}
              </h4>
              {isWalkthrough && (
                <span className="px-2 py-0.5 bg-[#FF4A1C]/10 dark:bg-[#FF4A1C]/20 text-[#FF4A1C] dark:text-[#FF4A1C] text-xs rounded-full font-medium">
                  Problem Solving
                </span>
              )}
              {isComfortable && !isWalkthrough && (
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Completed
                </span>
              )}
           </div>
           {!isExpanded && (
             <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 line-clamp-1">{unit.description}</p>
           )}
        </div>
      </div>

      {isExpanded && (
        <div className="pl-12 pr-6 pb-8 animate-fade-in">
          {/* Detailed Description */}
          <p className="text-stone-700 dark:text-stone-300 mb-4 leading-relaxed">
            {unit.description}
          </p>
          
          {/* Tutor Guidance */}
          {unit.tutor_guidance && (
            <div className={`mb-6 p-4 rounded-lg border bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700`}>
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {isWalkthrough ? (
                    <Sparkles className="w-4 h-4 text-[#FF4A1C] dark:text-[#FF4A1C]" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold uppercase tracking-wide mb-1 ${isWalkthrough ? 'text-[#FF4A1C] dark:text-[#FF4A1C]' : 'text-stone-700 dark:text-stone-300'}`}>
                    {isWalkthrough ? 'Problem-Solving Approach' : 'Core overview'}
                  </p>
                  <p className="text-stone-700 dark:text-stone-300 text-m leading-relaxed">
                    {unit.tutor_guidance}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Equations */}
          {equations && equations.length > 0 && (
            <div className="mb-6">
              <EquationDisplay equations={equations} />
            </div>
          )}
          
          {/* Figures */}
          {topicFigures && topicFigures.length > 0 && (
            <div className="mb-6">
              <FigureDisplay figures={topicFigures} />
            </div>
          )}

          {/* Action Buttons */}
          {!hasResources && !isComfortable && (
            <div className="flex items-center gap-3 mb-6">
               <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateBlueprint(unit);
                  }}
                  disabled={isSearching}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors bg-white dark:bg-stone-800 text-[#FF4A1C] border border-[#FF4A1C] hover:bg-[#FF4A1C]/5 dark:hover:bg-[#FF4A1C]/10`}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching Resources...
                    </>
                  ) : (
                    <>
                      {isWalkthrough ? <Play className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                      {isWalkthrough ? 'Find Worked Examples' : 'Find Resources'}
                    </>
                  )}
                </button>
                {!isWalkthrough && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onComfortSelect(unit.unit_id, 'comfortable');
                    }}
                    disabled={isSearching}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg 
                               hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors font-medium text-sm border border-stone-200 dark:border-stone-700"
                  >
                    <Check className="w-4 h-4" />
                    I know this
                  </button>
                )}
            </div>
          )}

          {/* Resources Table */}
          {hasResources && (
            <div className="mt-4">
              <h5 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isWalkthrough ? 'text-[#FF4A1C] dark:text-[#FF4A1C]' : 'text-stone-700 dark:text-stone-300'}`}>
                <Play className={`w-4 h-4 ${isWalkthrough ? 'text-[#FF4A1C] dark:text-[#FF4A1C]' : 'text-[#FF4A1C]'}`} />
                {isWalkthrough ? 'Worked Example Videos' : 'Recommended Resources'}
              </h5>
              <ResourceTable resources={topicResources} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN BLUEPRINT COMPONENT
// ============================================================================

const Blueprint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  
  // Data State
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [learningStructure, setLearningStructure] = useState(null);
  const [topicResponses, setTopicResponses] = useState({});
  const [topicResources, setTopicResources] = useState({});
  const [topicEquations, setTopicEquations] = useState({});
  const [topicFigures, setTopicFigures] = useState({});
  
  // Track resources that are currently being loaded to prevent overwrites
  const loadingResourcesRef = useRef(new Set());
  
  // UI State
  const [activeTab, setActiveTab] = useState(null);
  const [expandedTopics, setExpandedTopics] = useState({});
  
  // Generation State
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('pending');
  const [generationError, setGenerationError] = useState(null);
  const [searchingTopics, setSearchingTopics] = useState(new Set());
  
  // Debug State
  const [showDebug, setShowDebug] = useState(false);
  const [documentAnalysis, setDocumentAnalysis] = useState(null);
  const [structureGenerationResult, setStructureGenerationResult] = useState(null);

  // Fetch blueprint data
  const fetchBlueprint = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('blueprints')
        .select(`
          *,
          class:classes(id, name, professor)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      // Fetch associated document if it exists
      if (data.document_id) {
        const { data: docData } = await supabase
          .from('class_documents')
          .select('*')
          .eq('id', data.document_id)
          .single();
        
        if (docData) {
          data.document = docData;
        }
      }

      setBlueprint(data);

      // Update last_viewed_at
      supabase.from('blueprints')
        .update({ last_viewed_at: new Date().toISOString() })
        .eq('id', id);

      setGenerationStatus(data.generation_status || 'pending');
      setGenerationError(data.generation_error);
      
      // Load Structure
      const { data: structureData } = await supabase
        .from('blueprint_structures')
        .select('*')
        .eq('blueprint_id', id)
        .maybeSingle();
      
      if (structureData) {
        setLearningStructure(structureData);
        // Also set structure generation result for debug panel
        setStructureGenerationResult({
          success: true,
          structure_id: structureData.id,
          structure: structureData.structure,
          metrics: {
            total_prerequisites: structureData.total_prerequisites,
            total_sections: structureData.total_sections,
            total_learning_units: structureData.total_learning_units,
            total_search_queries: structureData.total_search_queries,
          },
          equations: {
            cached: 0, // We don't store this in the DB
            new: 0,
            total: 0,
          },
          created_at: structureData.created_at,
          // Cache information (if available)
          from_cache: structureData.from_cache || false,
          cache_similarity: structureData.cache_similarity,
          cache_source_id: structureData.cache_source_id,
          model_used: structureData.model_used || 'claude-haiku-4-5',
        });
      }

      // Load Document Analysis (for debug panel)
      // First try to find by document_id (multiple blueprints can share same document analysis)
      // Then fall back to blueprint_id (legacy/backwards compatibility)
      let analysisData = null;
      
      if (data.document_id) {
        console.log('[Blueprint] Looking for document analysis by document_id:', data.document_id);
        const { data: docAnalysis } = await supabase
          .from('document_analyses')
          .select('*')
          .eq('document_id', data.document_id)
          .maybeSingle();
        
        if (docAnalysis) {
          console.log('[Blueprint] Found document analysis by document_id:', docAnalysis.id);
          analysisData = docAnalysis;
        }
      }
      
      // Fallback: try by blueprint_id
      if (!analysisData) {
        console.log('[Blueprint] Looking for document analysis by blueprint_id:', id);
        const { data: bpAnalysis } = await supabase
          .from('document_analyses')
          .select('*')
          .eq('blueprint_id', id)
          .maybeSingle();
        
        if (bpAnalysis) {
          console.log('[Blueprint] Found document analysis by blueprint_id:', bpAnalysis.id);
          analysisData = bpAnalysis;
        }
      }
      
      if (analysisData) {
        setDocumentAnalysis({
          success: true,
          analysis_id: analysisData.id,
          document_type: analysisData.raw_analysis?.document_type,
          subject_area: analysisData.raw_analysis?.subject_area,
          raw_analysis: analysisData.raw_analysis,
          analyzed_at: analysisData.created_at,
          source: analysisData.document_id ? 'document_id' : 'blueprint_id',
        });
      }

      // Load Topic Responses
      const { data: responsesData } = await supabase
        .from('topic_responses')
        .select('*')
        .eq('blueprint_id', id)
        .eq('user_id', user.id);
      
      if (responsesData) {
        const responsesMap = {};
        responsesData.forEach(r => responsesMap[r.unit_id] = r);
        setTopicResponses(responsesMap);
      }

      // Load Topic Resources
      const { data: resourcesData } = await supabase
        .from('blueprint_topic_resources')
        .select(`*, curated_resources (*)`)
        .eq('blueprint_id', id);
      
      if (resourcesData) {
        const resourcesMap = {};
        resourcesData.forEach(r => {
          if (!resourcesMap[r.unit_id]) resourcesMap[r.unit_id] = [];
          if (r.curated_resources) {
            resourcesMap[r.unit_id].push({
              ...r.curated_resources,
              relevance_score: r.relevance_score,
              from_cache: r.from_cache,
              resource_explanation: r.resource_explanation,
            });
          }
        });
        // Only update resources that aren't currently being loaded
        setTopicResources(prev => {
          const updated = { ...prev };
          for (const [unitId, resources] of Object.entries(resourcesMap)) {
            // Don't overwrite resources that are currently being loaded from API
            if (!loadingResourcesRef.current.has(unitId)) {
              updated[unitId] = resources;
            }
          }
          return updated;
        });
      }

      // Load Equations
      const { data: equationsData } = await supabase
        .from('blueprint_unit_equations')
        .select(`*, curated_equations (*)`)
        .eq('blueprint_id', id)
        .order('display_index', { ascending: true });
        
      if (equationsData) {
        const equationsMap = {};
        equationsData.forEach(e => {
          if (!equationsMap[e.unit_id]) equationsMap[e.unit_id] = [];
          if (e.curated_equations) {
             equationsMap[e.unit_id].push({
               ...e.curated_equations,
               index: e.display_index
             });
          }
        });
        setTopicEquations(equationsMap);
      }
      
      // Load Figures
      const { data: figuresData } = await supabase
        .from('blueprint_unit_figures')
        .select(`*, curated_figures (*)`)
        .eq('blueprint_id', id)
        .order('display_index', { ascending: true });
      
      if (figuresData) {
        const figuresMap = {};
        figuresData.forEach(f => {
          if (!figuresMap[f.unit_id]) figuresMap[f.unit_id] = [];
          if (f.curated_figures) {
            figuresMap[f.unit_id].push({
              ...f.curated_figures,
              relevance_explanation: f.relevance_explanation,
              from_cache: f.from_cache,
            });
          }
        });
        setTopicFigures(figuresMap);
      }
      
    } catch (error) {
      console.error('Error fetching blueprint:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, navigate]);

  useEffect(() => {
    if (user && id) fetchBlueprint();
  }, [user, id, fetchBlueprint]);

  // Set initial active tab when structure loads
  useEffect(() => {
    console.log('[Blueprint] Tab initialization effect triggered');
    console.log('[Blueprint]   - Has learningStructure:', !!learningStructure);
    console.log('[Blueprint]   - Has structure:', !!learningStructure?.structure);
    console.log('[Blueprint]   - Current activeTab:', activeTab);
    
    if (learningStructure?.structure) {
      const struct = learningStructure.structure;
      console.log('[Blueprint] Structure details:', {
        has_prerequisites: !!struct.prerequisites_section,
        prereq_unit_count: struct.prerequisites_section?.learning_units?.length || 0,
        has_content_sections: !!struct.content_sections,
        content_section_count: struct.content_sections?.length || 0,
        structure_keys: Object.keys(struct)
      });
      
      // Log full structure to console for inspection
      console.log('[Blueprint] Full structure object:', struct);
    }
    
    if (learningStructure?.structure && !activeTab) {
      if (learningStructure.structure.prerequisites_section?.learning_units?.length > 0) {
        console.log('[Blueprint] Setting activeTab to prerequisites');
        setActiveTab('prerequisites');
      } else if (learningStructure.structure.content_sections?.length > 0) {
        const firstSectionId = learningStructure.structure.content_sections[0].section_id || 'section-0';
        console.log('[Blueprint] Setting activeTab to first section:', firstSectionId);
        setActiveTab(firstSectionId);
      } else {
        console.log('[Blueprint] ❌ No sections found to set as active tab');
        console.log('[Blueprint] This means content_sections is empty or missing');
      }
    }
  }, [learningStructure, activeTab]);

  // Handle comfort selection
  const handleComfortSelect = async (unitId, response) => {
    try {
      const { error } = await supabase.from('topic_responses').upsert({
        blueprint_id: id,
        unit_id: unitId,
        user_id: user.id,
        response: response,
      }, { onConflict: 'blueprint_id,unit_id' });

      if (error) throw error;

      setTopicResponses(prev => ({
        ...prev,
        [unitId]: { unit_id: unitId, response },
      }));
    } catch (error) {
      console.error('Error saving comfort response:', error);
    }
  };

  // Handle generation
  const handleGenerateBlueprint = async (unit) => {
    if (!session?.access_token) return;
    const unitId = unit.unit_id;
    
    // Mark this unit as currently loading to prevent overwrites
    loadingResourcesRef.current.add(unitId);
    setSearchingTopics(prev => new Set([...prev, unitId]));

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Determine endpoint based on unit_type
      // walkthrough units should use search-problem-walkthroughs endpoint
      const isWalkthrough = unit.unit_type === 'walkthrough';
      const endpoint = isWalkthrough ? 'search-problem-walkthroughs' : 'search-resources';
      
      // For walkthrough units, try to get the problem statement from the document analysis
      let problemStatement = null;
      if (isWalkthrough && documentAnalysis?.raw_analysis) {
        // Find the problem statement from the document analysis
        // The unit should be part of a content_section, so we need to find the matching section
        const sections = documentAnalysis.raw_analysis.sections || [];
        
        // Try to find a matching section by looking at the current active section
        const currentSection = structure?.content_sections?.find(s => 
          s.learning_units?.some(u => u.unit_id === unitId)
        );
        
        if (currentSection && currentSection.section_id) {
          // Find the corresponding section in the raw analysis
          const analysisSection = sections.find(s => 
            s.section_id === currentSection.section_id || 
            s.section_id === currentSection.section_id.replace('_walkthroughs', '')
          );
          
          if (analysisSection && analysisSection.problem_statement) {
            problemStatement = analysisSection.problem_statement;
            console.log('[Blueprint] Found problem statement for walkthrough unit:', problemStatement.substring(0, 100));
          }
        }
      }
      
      const requestBody = isWalkthrough ? {
        blueprint_id: id,
        unit_id: unitId,
        topic: unit.topic,
        description: unit.description,
        learning_objective: unit.learning_objective,
        problem_statement: problemStatement, // Include the actual problem text
        problem_solving_queries: unit.search_queries || [], // For walkthrough units, search_queries contain the problem-solving queries
        problem_details: unit.problem_details || {},
      } : {
        blueprint_id: id,
        unit_id: unitId,
        topic: unit.topic,
        description: unit.description,
        learning_objective: unit.learning_objective,
        search_queries: unit.search_queries || [],
      };
      
      console.log(`[Blueprint] Fetching resources for unit ${unitId} (type: ${unit.unit_type})...`);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Search failed');

      if (data.resources && data.resources.length > 0) {
        console.log(`[Blueprint] Received ${data.resources.length} resources for unit ${unitId}`);
        
        // Update resources state - this will persist
        setTopicResources(prev => {
          const updated = { ...prev, [unitId]: data.resources };
          console.log(`[Blueprint] Updated topicResources for unit ${unitId}`, updated[unitId]);
          return updated;
        });
        
        // Update topic responses to mark as searched
        setTopicResponses(prev => ({
          ...prev,
          [unitId]: { unit_id: unitId, response: 'needs_help', searched_at: new Date().toISOString() },
        }));
        
        // Keep the loading ref set for a bit longer to prevent database load from overwriting
        setTimeout(() => {
          loadingResourcesRef.current.delete(unitId);
          console.log(`[Blueprint] Released loading lock for unit ${unitId}`);
        }, 3000);
      } else {
        // No resources found
        console.warn(`[Blueprint] No resources found for unit ${unitId}`);
        loadingResourcesRef.current.delete(unitId);
        alert('No resources found for this topic. Please try again later.');
      }
      
    } catch (error) {
      console.error('[Blueprint] Error finding resources:', error);
      loadingResourcesRef.current.delete(unitId);
      alert(`Failed to find resources: ${error.message}`);
    } finally {
      setSearchingTopics(prev => {
        const next = new Set(prev);
        next.delete(unitId);
        return next;
      });
    }
  };

  const handleViewDocument = async () => {
    // Get document from blueprint.document (linked via document_id) or file_metadata (embedded)
    const doc = blueprint.document || (blueprint.file_metadata ? {
      ...blueprint.file_metadata,
      file_url: blueprint.file_metadata.url
    } : null);

    if (!doc || !doc.file_url) {
      alert('❌ No document associated with this blueprint.');
      return;
    }
    
    try {
      // Simply open the public URL directly, like ClassDetails does
      window.open(doc.file_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('❌ Failed to open document.\n\nError: ' + error.message);
    }
  };

  const runAllSteps = async () => {
    if (!session?.access_token) return;
    setGenerating(true);
    setGenerationError(null);
    setGenerationStatus('analyzing');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Analyze
      let response = await fetch(`${supabaseUrl}/functions/v1/analyze-document`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprint_id: id }),
      });
      let data = await response.json();
      if (!data.success) throw new Error(data.error);
      setDocumentAnalysis(data);

      // Generate Structure
      setGenerationStatus('generating');
      response = await fetch(`${supabaseUrl}/functions/v1/generate-structure`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprint_id: id }),
      });
      data = await response.json();
      if (!data.success) throw new Error(data.error);
      setStructureGenerationResult(data);

      await fetchBlueprint();
    } catch (error) {
      setGenerationError(error.message);
      setGenerationStatus('failed');
    } finally {
      setGenerating(false);
    }
  };

  const runAnalyzeStep = async () => {
    if (!session?.access_token) return;
    
    // If we already have an analysis loaded, just update the status
    if (documentAnalysis) {
      console.log('[Blueprint] Analysis already exists, updating status to analyzed');
      setGenerationStatus('analyzed');
      return;
    }
    
    setGenerating(true);
    setGenerationError(null);
    setGenerationStatus('analyzing');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-document`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprint_id: id }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      
      setDocumentAnalysis(data);
      setGenerationStatus('analyzed');
      await fetchBlueprint();
    } catch (error) {
      setGenerationError(error.message);
      setGenerationStatus('failed');
    } finally {
      setGenerating(false);
    }
  };

  const runStructureStep = async () => {
    if (!session?.access_token) return;
    setGenerating(true);
    setGenerationError(null);
    setGenerationStatus('generating');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-structure`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprint_id: id }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      
      setStructureGenerationResult(data);
      await fetchBlueprint();
    } catch (error) {
      setGenerationError(error.message);
      setGenerationStatus('failed');
    } finally {
      setGenerating(false);
    }
  };

  const toggleTopic = (unitId) => {
    setExpandedTopics(prev => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-stone-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4A1C]" />
      </div>
    );
  }
  if (!blueprint) return null;

  const content = blueprint.content || {};
  const structure = learningStructure?.structure;
  const StatusIcon = STATUS_CONFIG[generationStatus]?.icon || Loader2;
  const statusConfig = STATUS_CONFIG[generationStatus] || STATUS_CONFIG.pending;

  // Build tabs list
  const tabs = [];
  if (structure) {
    if (structure.prerequisites_section?.learning_units?.length > 0) {
      tabs.push({ id: 'prerequisites', label: 'Prerequisites', fullTitle: 'Prerequisites' });
    }
    if (structure.content_sections) {
      structure.content_sections.forEach((section, idx) => {
        let labelPrefix = 'Topic';
        if (section.section_type === 'problem' || section.title?.toLowerCase().includes('problem')) {
          labelPrefix = 'Problem';
        }
        
        tabs.push({ 
          id: section.section_id || `section-${idx}`, 
          label: `${labelPrefix} ${idx + 1}`,
          fullTitle: section.title,
          sectionIndex: idx 
        });
      });
    }
  }

  // Get current units to display
  let currentUnits = [];
  let currentSectionTitle = '';
  
  if (activeTab === 'prerequisites') {
    currentUnits = structure?.prerequisites_section?.learning_units || [];
    currentSectionTitle = 'Prerequisites';
    console.log('[Blueprint] Prerequisites tab active, units:', currentUnits.length);
  } else if (activeTab && structure?.content_sections) {
    console.log('[Blueprint] Looking for activeTab:', activeTab);
    console.log('[Blueprint] Available sections:', structure.content_sections.map((s, idx) => ({
      section_id: s.section_id,
      fallback: `section-${idx}`,
      title: s.title,
      has_units: !!s.learning_units,
      unit_count: s.learning_units?.length || 0
    })));
    
    const activeSection = structure.content_sections.find(
      (s, idx) => (s.section_id || `section-${idx}`) === activeTab
    );
    
    console.log('[Blueprint] Found activeSection:', !!activeSection);
    if (activeSection) {
      console.log('[Blueprint] Active section details:', {
        title: activeSection.title,
        has_learning_units: !!activeSection.learning_units,
        unit_count: activeSection.learning_units?.length || 0
      });
    }
    
    currentUnits = activeSection?.learning_units || [];
    currentSectionTitle = activeSection?.title || '';
  }
  
  console.log('[Blueprint] Final currentUnits count:', currentUnits.length);

  const doc = blueprint.document || (blueprint.file_metadata ? {
    name: blueprint.file_metadata.name,
    file_size: blueprint.file_metadata.size,
    file_type: blueprint.file_metadata.type
  } : null);

  return (
    <div 
      className="min-h-screen bg-transparent flex text-outline relative"
    >
      {/* Backgrounds */}
      {/* Removed bgMode === 'default' background logic to match ClassDetails */}

      {/* Sidebars */}
      <div className="fixed top-20 left-0 h-[calc(100vh-80px)] z-30 hidden lg:block w-20">
        <Sidebar collapsed={true} />
      </div>
      <div className="fixed top-20 left-20 h-[calc(100vh-80px)] z-20 hidden lg:block w-56 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800">
        <ClassSidebar />
      </div>

      <div className="flex-1 min-w-0 lg:ml-[304px] relative z-10">
        <div className="pt-8 pb-12 px-6 lg:px-12 max-w-7xl mx-auto space-y-12">
          {/* Header */}
          <div className="flex flex-col lg:flex-row gap-6 items-start justify-between mb-8">
            <div className="flex-1 min-w-0">
              <button 
                onClick={() => {
                  if (blueprint.class_id) {
                    navigate(`/class/${blueprint.class_id}?tab=blueprints`);
                  } else {
                    navigate('/dashboard');
                  }
                }}
                className="flex items-center gap-2 text-stone-500 hover:text-[#FF4A1C] transition-colors mb-4 text-sm font-medium dark:text-stone-400"
              >
                <ArrowLeft className="w-4 h-4" />
                {blueprint.class_id ? `Back to ${blueprint.class?.name || 'Class'}` : 'Back to Dashboard'}
              </button>

              <div className="flex items-center gap-3">
                <h1 className="text-4xl text-[#2A2B2A] dark:text-stone-100">
                  {blueprint.title || content.blueprintName || 'Untitled Blueprint'}
                </h1>
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  title="Toggle Debug Panel"
                >
                  <Bug className={`w-5 h-5 ${showDebug ? 'text-[#FF4A1C]' : 'text-stone-400'}`} />
                </button>
              </div>
              <p className="text-stone-500 text-lg dark:text-stone-400 mt-2">
                {blueprint.class?.name ? `${blueprint.class.name} ` : ''}
              </p>
            </div>

            {/* Document Card */}
            {doc && (
              <div className="w-full lg:w-80 shrink-0 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-stone-100 dark:bg-stone-900 rounded-lg text-stone-500 dark:text-stone-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-stone-900 dark:text-stone-100 text-sm truncate" title={doc.name}>
                      {doc.name}
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'Document'}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={handleViewDocument}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Document
                </button>
              </div>
            )}
          </div>

          {/* Debug Panel */}
          {showDebug && (
            <div className="bg-stone-900 text-stone-100 rounded-xl p-6 shadow-lg mb-8 font-mono text-xs overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#FF4A1C]">🐛 Debug Panel</h3>
                <button
                  onClick={() => setShowDebug(false)}
                  className="text-stone-400 hover:text-stone-200 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Document Analysis Result */}
                {documentAnalysis && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">📄 Document Analysis Result</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto max-h-96">
                      {JSON.stringify(documentAnalysis, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Structure Generation Result */}
                {structureGenerationResult && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">🏗️ Structure Generation Result</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto max-h-96">
                      {JSON.stringify(structureGenerationResult, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Blueprint Info */}
                <div>
                  <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">📋 Blueprint Info</h4>
                  <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                    {JSON.stringify({
                      id: blueprint.id,
                      title: blueprint.title,
                      class_id: blueprint.class_id,
                      document_id: blueprint.document_id,
                      generation_status: blueprint.generation_status,
                      created_at: blueprint.created_at,
                    }, null, 2)}
                  </pre>
                </div>

                {/* Structure Info */}
                {learningStructure && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">🏗️ Learning Structure</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto max-h-96">
                      {JSON.stringify({
                        structure_id: learningStructure.id,
                        total_prerequisites: learningStructure.total_prerequisites,
                        total_sections: learningStructure.total_sections,
                        total_learning_units: learningStructure.total_learning_units,
                        total_search_queries: learningStructure.total_search_queries,
                        model_used: learningStructure.model_used,
                        from_cache: learningStructure.from_cache || false,
                        cache_similarity: learningStructure.cache_similarity ? `${(learningStructure.cache_similarity * 100).toFixed(1)}%` : null,
                        token_savings: learningStructure.from_cache ? '~24,000 tokens (~$0.06)' : 'N/A',
                        created_at: learningStructure.created_at,
                      }, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Active Tab & Section */}
                {structure && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">📑 Active Section</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                      {JSON.stringify({
                        activeTab: activeTab,
                        currentSectionTitle: currentSectionTitle,
                        currentUnitsCount: currentUnits.length,
                        currentUnits: currentUnits.map(u => ({
                          unit_id: u.unit_id,
                          unit_type: u.unit_type,
                          topic: u.topic,
                          has_resources: topicResources[u.unit_id]?.length || 0,
                          is_searching: searchingTopics.has(u.unit_id),
                          is_expanded: expandedTopics[u.unit_id] || false,
                        })),
                      }, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Topic Resources */}
                {Object.keys(topicResources).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">📚 Resources Loaded</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto max-h-96">
                      {JSON.stringify(
                        Object.entries(topicResources).map(([unitId, resources]) => ({
                          unit_id: unitId,
                          resource_count: resources.length,
                          resources: resources.map(r => ({
                            title: r.title,
                            url: r.url,
                            platform: r.platform,
                            channel: r.channel_name,
                            from_cache: r.from_cache,
                            quality_score: r.quality_score,
                            has_explanation: !!r.resource_explanation,
                          })),
                        })),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}

                {/* Topic Equations */}
                {Object.keys(topicEquations).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">🧮 Equations Loaded</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                      {JSON.stringify(
                        Object.entries(topicEquations).map(([unitId, equations]) => ({
                          unit_id: unitId,
                          equations_count: equations.length,
                          equations: equations.map(eq => ({
                            name: eq.name,
                            latex: eq.latex,
                          })),
                        })),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}

                {/* Topic Responses */}
                {Object.keys(topicResponses).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">✅ User Responses</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                      {JSON.stringify(topicResponses, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Searching State */}
                {searchingTopics.size > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">🔍 Currently Searching</h4>
                    <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                      {JSON.stringify(Array.from(searchingTopics), null, 2)}
                    </pre>
                  </div>
                )}

                {/* Generation Status */}
                <div>
                  <h4 className="text-sm font-semibold text-[#FF4A1C] mb-2">⚙️ Generation State</h4>
                  <pre className="bg-stone-950 p-3 rounded overflow-x-auto">
                    {JSON.stringify({
                      generating: generating,
                      generationStatus: generationStatus,
                      generationError: generationError,
                      tabs: tabs,
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* No Structure State - Show Generation UI */}
          {!structure && (
            <div className="bg-white dark:bg-stone-900 rounded-3xl p-8 shadow-sm border border-stone-300 dark:border-stone-600 mt-8">
               <div className="text-center py-8">
                <h3 className="text-xl font-bold text-[#2A2B2A] dark:text-stone-100 mb-2">
                  Ready to Generate Your Learning Path
                </h3>
                <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-md mx-auto">
                  Analyze your document and create a personalized learning path with topics and resources.
                </p>
                
                <div className="flex flex-col items-center gap-4">
                  {/* Step buttons - always visible */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={runAnalyzeStep}
                      disabled={generating && generationStatus === 'analyzing'}
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 border rounded-lg transition-all font-medium ${
                        documentAnalysis || generationStatus === 'analyzed' || generationStatus === 'structure_generated' || generationStatus === 'completed'
                          ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-600 text-green-900 dark:text-green-100'
                          : 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800/40'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {documentAnalysis || generationStatus === 'analyzed' || generationStatus === 'structure_generated' || generationStatus === 'completed' ? (
                        <>
                          <Check className="w-4 h-4" />
                          1. Analyzed ✓
                        </>
                      ) : generating && generationStatus === 'analyzing' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          1. Analyze Document
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={runStructureStep}
                      disabled={(!documentAnalysis && generationStatus === 'pending' || generationStatus === 'analyzing' || generationStatus === 'failed') || (generating && generationStatus === 'generating')}
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 border rounded-lg transition-all font-medium ${
                        generationStatus === 'structure_generated' || generationStatus === 'completed'
                          ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-600 text-green-900 dark:text-green-100'
                          : 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-600 text-purple-900 dark:text-purple-100 hover:bg-purple-200 dark:hover:bg-purple-800/40'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {generationStatus === 'structure_generated' || generationStatus === 'completed' ? (
                        <>
                          <Check className="w-4 h-4" />
                          2. Generated ✓
                        </>
                      ) : generating && generationStatus === 'generating' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Target className="w-4 h-4" />
                          2. Generate Structure
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* Status message */}
                  {(documentAnalysis || generationStatus === 'analyzed') && !structure && (
                    <div className="inline-flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-100 text-sm">
                      <Check className="w-4 h-4" />
                      <span>Document analyzed! Click step 2 to continue.</span>
                    </div>
                  )}
                  
                  {generationStatus === 'structure_generated' && (
                    <div className="inline-flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-100 text-sm">
                      <Check className="w-4 h-4" />
                      <span>Structure generated! Refresh to see your learning path.</span>
                    </div>
                  )}
                  
                  {/* "Run All" option */}
                  {(generationStatus === 'pending' || generationStatus === 'failed') && (
                    <button
                      onClick={runAllSteps}
                      disabled={generating}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-all text-[#2A2B2A] dark:text-stone-100 font-medium disabled:opacity-50 text-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      {generating ? 'Running...' : 'Or Run All Steps'}
                    </button>
                  )}
                </div>
                
                {generationError && (
                  <p className="mt-4 text-red-500 text-sm">{generationError}</p>
                )}
              </div>
            </div>
          )}

          {/* Structure Content */}
          {structure && (
            <>
              {/* Bucket Navigation (Tabs) */}
              <div className="mb-8">
                <div className="flex justify-center mb-4 px-4">
                  <div className="inline-flex bg-stone-100/50 dark:bg-stone-800/50 p-1 rounded-lg overflow-x-auto max-w-full no-scrollbar border border-stone-200 dark:border-stone-700">
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap snap-center ${
                          activeTab === tab.id
                            ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm border border-stone-200 dark:border-stone-600'
                            : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 border border-transparent'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Active Section Header */}
                <div className="mt-4 flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-[#2A2B2A] dark:text-stone-100">{currentSectionTitle}</h2>
                  {learningStructure?.from_cache && (
                    <span 
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-300"
                      title={`Reused cached structure (${(learningStructure.cache_similarity * 100).toFixed(1)}% similar) - saved ~24,000 tokens`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Optimized
                    </span>
                  )}
                </div>
              </div>

              {/* Topic List */}
              <div className="space-y-4">
                {currentUnits.length > 0 ? (
                    currentUnits.map((unit, idx) => (
                      <div key={unit.unit_id || idx} className="bg-white dark:bg-stone-800 rounded-xl border border-stone-300 dark:border-stone-600 shadow-sm overflow-hidden">
                        <TopicListItem
                          unit={unit}
                          blueprintId={id}
                          topicResponse={topicResponses[unit.unit_id]}
                          topicResources={topicResources[unit.unit_id]}
                          topicEquations={topicEquations[unit.unit_id]}
                          topicFigures={topicFigures[unit.unit_id]}
                          onComfortSelect={handleComfortSelect}
                          onGenerateBlueprint={handleGenerateBlueprint}
                          isSearching={searchingTopics.has(unit.unit_id)}
                          isExpanded={expandedTopics[unit.unit_id]}
                          onToggle={() => toggleTopic(unit.unit_id)}
                        />
                      </div>
                    ))
                ) : (
                  <div className="p-8 text-center text-stone-500 dark:text-stone-400 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                    No topics found in this section.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Blueprint;
