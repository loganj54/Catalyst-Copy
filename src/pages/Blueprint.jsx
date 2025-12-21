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

  if (!resources || resources.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-stone-200 dark:border-stone-700">
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
                      {resource.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-stone-500 dark:text-stone-400">
                      {getPlatformIcon(resource.platform)}
                      <span>{resource.channel_name || resource.platform}</span>
                    </div>
                  </div>
                </a>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-stone-600 dark:text-stone-300 line-clamp-3">
                  {resource.resource_explanation ? (
                     <span>
                        <span className="font-semibold text-purple-600 dark:text-purple-400">Why this helps: </span>
                        {resource.resource_explanation}
                     </span>
                  ) : (
                    resource.description || 'No description available.'
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
  onComfortSelect,
  onGenerateBlueprint,
  isSearching,
  isExpanded,
  onToggle
}) => {
  const hasResources = topicResources && topicResources.length > 0;
  const isComfortable = topicResponse?.response === 'comfortable';
  
  // Use equations from database if available, fallback to structure data
  const equations = topicEquations && topicEquations.length > 0 
    ? topicEquations 
    : unit.equations;

  return (
    <div className={`border-b border-stone-100 dark:border-stone-700 last:border-0 transition-colors ${isExpanded ? 'bg-stone-50/50 dark:bg-stone-800/50' : 'hover:bg-stone-50/30 dark:hover:bg-stone-800/30'}`}>
      <div 
        onClick={onToggle}
        className="w-full text-left py-4 px-4 flex items-start gap-3 cursor-pointer group select-none"
      >
        <div className="mt-1 text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors">
           {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </div>
        
        <div className="flex-1 min-w-0">
           <div className="flex items-center gap-3">
              <h4 className="font-semibold text-lg text-[#2A2B2A] dark:text-stone-100">
                {unit.topic}
              </h4>
              {isComfortable && (
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
            <div className="mb-6 p-4 bg-stone-50 dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-stone-200 dark:bg-stone-800 rounded-lg shrink-0">
                  <Sparkles className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wide mb-1">
                    Core overview
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

          {/* Action Buttons */}
          {!hasResources && !isComfortable && (
            <div className="flex items-center gap-3 mb-6">
               <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateBlueprint(unit);
                  }}
                  disabled={isSearching}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-stone-800 text-[#FF4A1C] border border-[#FF4A1C] rounded-lg 
                             hover:bg-[#FF4A1C]/5 dark:hover:bg-[#FF4A1C]/10 transition-colors font-medium text-sm disabled:opacity-50"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching Resources...
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4" />
                      Find Resources
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onComfortSelect(unit.unit_id, 'comfortable');
                  }}
                  disabled={isSearching}
                  className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg 
                             hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors font-medium text-sm"
                >
                  <Check className="w-4 h-4" />
                  I know this
                </button>
            </div>
          )}

          {/* Resources Table */}
          {hasResources && (
            <div className="mt-4">
              <h5 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2 flex items-center gap-2">
                <Play className="w-4 h-4 text-[#FF4A1C]" />
                Recommended Resources
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
    if (learningStructure?.structure && !activeTab) {
      if (learningStructure.structure.prerequisites_section?.learning_units?.length > 0) {
        setActiveTab('prerequisites');
      } else if (learningStructure.structure.content_sections?.length > 0) {
        setActiveTab(learningStructure.structure.content_sections[0].section_id || 'section-0');
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
      const isProblem = unit.unit_type === 'problem';
      const endpoint = isProblem ? 'search-problem-walkthroughs' : 'search-resources';
      
      const requestBody = isProblem ? {
        blueprint_id: id,
        unit_id: unitId,
        topic: unit.topic,
        description: unit.description,
        learning_objective: unit.learning_objective,
        problem_solving_queries: unit.problem_solving_queries || [],
        problem_details: unit.problem_details || {},
      } : {
        blueprint_id: id,
        unit_id: unitId,
        topic: unit.topic,
        description: unit.description,
        learning_objective: unit.learning_objective,
        search_queries: unit.search_queries || [],
      };
      
      console.log(`[Blueprint] Fetching resources for unit ${unitId}...`);
      
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

      // Generate Structure
      setGenerationStatus('generating');
      response = await fetch(`${supabaseUrl}/functions/v1/generate-structure`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprint_id: id }),
      });
      data = await response.json();
      if (!data.success) throw new Error(data.error);

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
  } else if (activeTab && structure?.content_sections) {
    const activeSection = structure.content_sections.find(
      (s, idx) => (s.section_id || `section-${idx}`) === activeTab
    );
    currentUnits = activeSection?.learning_units || [];
    currentSectionTitle = activeSection?.title || '';
  }

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

              <h1 className="text-4xl text-[#2A2B2A] mb-2 dark:text-stone-100">
                {blueprint.title || content.blueprintName || 'Untitled Blueprint'}
              </h1>
              <p className="text-stone-500 text-lg dark:text-stone-400 ">
                {blueprint.class?.name ? `${blueprint.class.name} ` : ''}
              </p>
            </div>

            {/* Document Card */}
            {doc && (
              <div className="w-full lg:w-80 shrink-0 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
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
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Document
                </button>
              </div>
            )}
          </div>

          {/* No Structure State - Show Generation UI */}
          {!structure && (
            <div className="bg-white dark:bg-stone-900 rounded-3xl p-8 shadow-sm border border-stone-200 dark:border-stone-600 mt-8">
               <div className="text-center py-8">
                <h3 className="text-xl font-bold text-[#2A2B2A] dark:text-stone-100 mb-2">
                  Ready to Generate Your Learning Path
                </h3>
                <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-md mx-auto">
                  Analyze your document and create a personalized learning path with topics and resources.
                </p>
                
                {generationStatus === 'pending' || generationStatus === 'failed' ? (
                   <button
                    onClick={runAllSteps}
                    disabled={generating}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-all text-[#2A2B2A] dark:text-stone-100 font-medium disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    {generating ? 'Generating...' : 'Generate Learning Structure'}
                  </button>
                ) : (
                  <div className={`inline-flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm`}>
                    <StatusIcon className={`w-5 h-5 ${statusConfig.color} ${statusConfig.animate ? 'animate-pulse' : ''}`} />
                    <span className={`font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                )}
                
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
                  <div className="inline-flex bg-stone-100/50 dark:bg-stone-800/50 p-1 rounded-lg overflow-x-auto max-w-full no-scrollbar">
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap snap-center ${
                          activeTab === tab.id
                            ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                            : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Active Section Header */}
                <div className="mt-4">
                  <h2 className="text-2xl font-bold text-[#2A2B2A] dark:text-stone-100">{currentSectionTitle}</h2>
                </div>
              </div>

              {/* Topic List */}
              <div className="space-y-4">
                {currentUnits.length > 0 ? (
                    currentUnits.map((unit, idx) => (
                      <div key={unit.unit_id || idx} className="bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
                        <TopicListItem
                          unit={unit}
                          blueprintId={id}
                          topicResponse={topicResponses[unit.unit_id]}
                          topicResources={topicResources[unit.unit_id]}
                          topicEquations={topicEquations[unit.unit_id]}
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
