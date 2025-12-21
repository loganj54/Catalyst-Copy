import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, BookOpen, Target, Calendar, FileText, Loader2, Download, 
  ExternalLink, RefreshCw, AlertCircle, Sparkles, ChevronDown, ChevronUp, 
  ChevronRight, Bug, Check, Play, Youtube, Clock, Star, Zap, HelpCircle,
  Layout, Grid, Circle
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
    <div className="mt-4 overflow-hidden rounded-lg border border-stone-200">
      <table className="min-w-full divide-y divide-stone-200">
        <thead className="bg-stone-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider w-1/3">
              Resource
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
              Summary
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-stone-200">
          {resources.map((resource, idx) => (
            <tr key={resource.id || idx} className="hover:bg-stone-50 transition-colors">
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
                    <div className="text-sm font-medium text-stone-900 group-hover:text-[#FF4A1C] line-clamp-2">
                      {resource.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-stone-500">
                      {getPlatformIcon(resource.platform)}
                      <span>{resource.channel_name || resource.platform}</span>
                    </div>
                  </div>
                </a>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-stone-600 line-clamp-3">
                  {resource.resource_explanation ? (
                     <span>
                        <span className="font-semibold text-purple-600">Why this helps: </span>
                        {resource.resource_explanation}
                     </span>
                  ) : (
                    resource.description || 'No description available.'
                  )}
                </div>
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {resource.difficulty_level && (
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                      resource.difficulty_level.includes('beginner') ? 'bg-green-100 text-green-700' :
                      resource.difficulty_level.includes('intermediate') ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {resource.difficulty_level.split(' ')[0]}
                    </span>
                  )}
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
    <div className={`border-b border-stone-100 last:border-0 transition-colors ${isExpanded ? 'bg-stone-50/50' : 'hover:bg-stone-50/30'}`}>
      <div 
        onClick={onToggle}
        className="w-full text-left py-4 px-4 flex items-start gap-3 cursor-pointer group select-none"
      >
        <div className="mt-1 text-stone-400 group-hover:text-stone-600 transition-colors">
           {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </div>
        
        <div className="flex-1 min-w-0">
           <div className="flex items-center gap-3">
              <h4 className={`font-semibold text-lg ${isExpanded ? 'text-[#FF4A1C]' : 'text-[#2A2B2A]'}`}>
                {unit.topic}
              </h4>
              {isComfortable && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Completed
                </span>
              )}
           </div>
           {!isExpanded && (
             <p className="text-sm text-stone-500 mt-1 line-clamp-1">{unit.description}</p>
           )}
        </div>
      </div>

      {isExpanded && (
        <div className="pl-12 pr-6 pb-8 animate-fade-in">
          {/* Detailed Description */}
          <p className="text-stone-700 mb-4 leading-relaxed">
            {unit.description}
          </p>
          
          {/* Tutor Guidance */}
          {unit.tutor_guidance && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-blue-100 rounded-lg shrink-0">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                    Your Tutor Says
                  </p>
                  <p className="text-stone-700 text-sm leading-relaxed">
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
                  className="flex items-center gap-2 px-4 py-2 bg-[#FF4A1C] text-white rounded-lg 
                             hover:bg-black transition-colors font-medium text-sm disabled:opacity-50"
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
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg 
                             hover:bg-green-200 transition-colors font-medium text-sm"
                >
                  <Check className="w-4 h-4" />
                  I know this
                </button>
            </div>
          )}

          {/* Resources Table */}
          {hasResources && (
            <div className="mt-4">
              <h5 className="text-sm font-semibold text-stone-700 mb-2 flex items-center gap-2">
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
  
  // UI State
  const [activeTab, setActiveTab] = useState(null);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [bgMode, setBgMode] = useState('dots');
  
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
        setTopicResources(resourcesMap);
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

      if (data.resources) {
        setTopicResources(prev => ({ ...prev, [unitId]: data.resources }));
      }
      
      setTopicResponses(prev => ({
        ...prev,
        [unitId]: { unit_id: unitId, response: 'needs_help', searched_at: new Date().toISOString() },
      }));
    } catch (error) {
      alert(`Failed to find resources: ${error.message}`);
    } finally {
      setSearchingTopics(prev => {
        const next = new Set(prev);
        next.delete(unitId);
        return next;
      });
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

  const pageBackground = `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23a8a29e' fill-opacity='0.25'%3E%3Ccircle cx='5' cy='5' r='1.5'/%3E%3Ccircle cx='25' cy='5' r='1.5'/%3E%3Ccircle cx='65' cy='5' r='1.5'/%3E%3Ccircle cx='25' cy='25' r='1.5'/%3E%3Ccircle cx='45' cy='25' r='1.5'/%3E%3Ccircle cx='85' cy='25' r='1.5'/%3E%3Ccircle cx='5' cy='45' r='1.5'/%3E%3Ccircle cx='45' cy='45' r='1.5'/%3E%3Ccircle cx='65' cy='45' r='1.5'/%3E%3Ccircle cx='25' cy='65' r='1.5'/%3E%3Ccircle cx='65' cy='65' r='1.5'/%3E%3Ccircle cx='85' cy='65' r='1.5'/%3E%3Ccircle cx='5' cy='85' r='1.5'/%3E%3Ccircle cx='25' cy='85' r='1.5'/%3E%3Ccircle cx='85' cy='85' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`;

  if (loading) return null;
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
        tabs.push({ 
          id: section.section_id || `section-${idx}`, 
          label: `Topic ${idx + 1}`,
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

  return (
    <div 
      className="min-h-screen bg-white flex text-outline relative"
      style={{ backgroundImage: bgMode === 'dots' ? pageBackground : 'none' }}
    >
      {/* Backgrounds */}
      {bgMode === 'default' && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white"></div>
        </div>
      )}

      {/* Sidebars */}
      <div className="fixed top-20 left-0 h-[calc(100vh-80px)] z-30 hidden lg:block w-20">
        <Sidebar collapsed={true} />
      </div>
      <div className="fixed top-20 left-20 h-[calc(100vh-80px)] z-20 hidden lg:block w-56 bg-white border-r border-stone-200">
        <ClassSidebar />
      </div>

      <div className="flex-1 min-w-0 lg:ml-[19rem] relative z-10 pt-8 pb-12 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button 
              onClick={() => {
                if (blueprint.class_id) {
                  navigate(`/class/${blueprint.class_id}?tab=blueprints`);
                } else {
                  navigate('/dashboard');
                }
              }}
              className="flex items-center gap-2 text-stone-500 hover:text-[#FF4A1C] transition-colors mb-4 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              {blueprint.class_id ? `Back to ${blueprint.class?.name || 'Class'}` : 'Back to Dashboard'}
            </button>

            <h1 className="text-4xl  text-[#2A2B2A] mb-2">
              {blueprint.title || content.blueprintName || 'Untitled Blueprint'}
            </h1>
            <p className="text-stone-500 text-lg ">
              {blueprint.class?.name ? `${blueprint.class.name} ` : ''}
              
            </p>
          </div>

          {/* No Structure State - Show Generation UI */}
          {!structure && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100 mt-8">
               <div className="bg-gradient-to-br from-[#FF4A1C]/5 to-purple-50 rounded-2xl p-8 text-center border-2 border-dashed border-stone-200">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Sparkles className="w-8 h-8 text-[#FF4A1C]" />
                </div>
                <h3 className="text-xl font-bold text-[#2A2B2A] mb-2">
                  Ready to Generate Your Learning Path
                </h3>
                <p className="text-stone-600 mb-6 max-w-md mx-auto">
                  Analyze your document and create a personalized learning path with topics and resources.
                </p>
                
                {generationStatus === 'pending' || generationStatus === 'failed' ? (
                   <button
                    onClick={runAllSteps}
                    disabled={generating}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF4A1C] text-white rounded-xl 
                               hover:bg-black transition-colors font-medium disabled:opacity-50"
                  >
                    {generating ? 'Generating...' : 'Generate Learning Structure'}
                  </button>
                ) : (
                  <div className={`inline-flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-200 shadow-sm`}>
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
                <div className="flex justify-center mb-4">
                  <div className="inline-flex bg-stone-100/50 p-1 rounded-lg">
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                          activeTab === tab.id
                            ? 'bg-white text-stone-900 shadow-sm'
                            : 'text-stone-500 hover:text-stone-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Active Section Header */}
                <div className="mt-4">
                  <h2 className="text-2xl font-bold text-[#2A2B2A]">{currentSectionTitle}</h2>
                </div>
              </div>

              {/* Topic List */}
              <div className="space-y-4">
                {currentUnits.length > 0 ? (
                    currentUnits.map((unit, idx) => (
                      <div key={unit.unit_id || idx} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
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
                  <div className="p-8 text-center text-stone-500 bg-white rounded-xl border border-stone-200">
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
