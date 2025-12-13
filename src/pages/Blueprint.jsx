import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Target, Calendar, FileText, Loader2, Download, ExternalLink, RefreshCw, AlertCircle, Sparkles, ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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

const Blueprint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('pending');
  const [generationError, setGenerationError] = useState(null);
  
  // Debug state
  const [showDebug, setShowDebug] = useState(false);
  const [documentAnalysis, setDocumentAnalysis] = useState(null);
  const [blueprintResources, setBlueprintResources] = useState([]);

  // Fetch blueprint data
  const fetchBlueprint = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('blueprints')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setBlueprint(data);
      setGenerationStatus(data.generation_status || 'pending');
      setGenerationError(data.generation_error);
      
      // Fetch document analysis for this blueprint
      // Try two approaches:
      // 1. Find by blueprint_id (direct match)
      // 2. Find by matching document filename (for reused documents)
      
      let analysisData = null;
      let analysisError = null;
      
      // Approach 1: Direct blueprint match
      const { data: directMatch, error: directError } = await supabase
        .from('document_analyses')
        .select('*')
        .eq('blueprint_id', id)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 or 1 results
      
      if (directError) {
        console.error('Error fetching document analysis by blueprint_id:', directError);
        analysisError = directError;
      }
      
      if (directMatch) {
        console.log('✅ Document analysis found by blueprint_id:', directMatch);
        analysisData = directMatch;
      } else {
        // Approach 2: Search by document filename (for reused documents)
        const fileName = data.file_metadata?.name || data.content?.fileUpload?.name;
        
        if (fileName) {
          console.log('🔍 No direct match, searching by filename:', fileName);
          
          const { data: filenameMatch, error: filenameError } = await supabase
            .from('document_analyses')
            .select('*')
            .eq('source_filename', fileName)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (filenameError) {
            console.error('Error fetching document analysis by filename:', filenameError);
          }
          
          if (filenameMatch) {
            console.log('✅ Document analysis found by filename:', filenameMatch);
            analysisData = filenameMatch;
          }
        }
      }
      
      if (analysisData) {
        setDocumentAnalysis(analysisData);
      } else {
        console.log('ℹ️ No document analysis found for blueprint:', id);
      }

      // Fetch blueprint resources
      const { data: resourcesData } = await supabase
        .from('blueprint_resources')
        .select(`
          *,
          curated_resources (*)
        `)
        .eq('blueprint_id', id);
      
      if (resourcesData) {
        setBlueprintResources(resourcesData);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching blueprint:', error);
      alert('Failed to load blueprint');
      navigate('/dashboard');
      return null;
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, navigate]);

  // Trigger blueprint generation
  const triggerGeneration = useCallback(async () => {
    if (!session?.access_token) {
      console.error('No access token available');
      return;
    }

    setGenerating(true);
    setGenerationError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-blueprint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blueprint_id: id }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      // Refresh blueprint data to get the generated content
      await fetchBlueprint();
      
    } catch (error) {
      console.error('Generation error:', error);
      setGenerationError(error.message);
      setGenerationStatus('failed');
    } finally {
      setGenerating(false);
    }
  }, [id, session?.access_token, fetchBlueprint]);

  // Step-by-step generation functions - each calls a SEPARATE edge function
  const runAnalyzeDocument = async () => {
    if (!session?.access_token) {
      console.error('No access token available');
      return;
    }

    setGenerating(true);
    setGenerationError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      console.log('Calling analyze-document edge function...');
      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blueprint_id: id }),
      });

      const data = await response.json();
      console.log('analyze-document result:', data);

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Refresh blueprint data
      await fetchBlueprint();
      
      alert(`✅ Step 1 (Analyze Document) completed!\n\nTopics found: ${data.analysis?.topics?.length || 0}\nPrerequisites: ${data.analysis?.prerequisites?.length || 0}\n\nCheck the debug panel for full analysis.`);
      
    } catch (error) {
      console.error('analyze-document error:', error);
      setGenerationError(error.message);
      alert(`❌ Step 1 (Analyze Document) failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const runGenerateStructure = async () => {
    if (!session?.access_token) {
      console.error('No access token available');
      return;
    }

    setGenerating(true);
    setGenerationError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      console.log('Calling generate-structure edge function...');
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-structure`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blueprint_id: id }),
      });

      const data = await response.json();
      console.log('generate-structure result:', data);

      if (!data.success) {
        throw new Error(data.error || 'Structure generation failed');
      }

      // Refresh blueprint data
      await fetchBlueprint();
      
      alert(`✅ Step 2 (Generate Structure) completed!\n\nTitle: ${data.structure?.title || 'N/A'}\nSections: ${data.structure?.sections?.length || 0}\n\nCheck the debug panel for full structure.`);
      
    } catch (error) {
      console.error('generate-structure error:', error);
      setGenerationError(error.message);
      alert(`❌ Step 2 (Generate Structure) failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const runSearchResources = async () => {
    if (!session?.access_token) {
      console.error('No access token available');
      return;
    }

    setGenerating(true);
    setGenerationError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      console.log('Calling search-resources edge function...');
      const response = await fetch(`${supabaseUrl}/functions/v1/search-resources`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blueprint_id: id }),
      });

      const data = await response.json();
      console.log('search-resources result:', data);

      if (!data.success) {
        throw new Error(data.error || 'Resource search failed');
      }

      // Refresh blueprint data
      await fetchBlueprint();
      
      alert(`✅ Step 3 (Search Resources) completed!\n\nTotal resources: ${data.resources_count || 0}\nCached: ${data.cached_count || 0}\nNew: ${data.new_count || 0}\n\n🎉 Blueprint generation complete!`);
      
    } catch (error) {
      console.error('search-resources error:', error);
      setGenerationError(error.message);
      alert(`❌ Step 3 (Search Resources) failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const runAllSteps = async () => {
    if (!session?.access_token) {
      console.error('No access token available');
      return;
    }

    setGenerating(true);
    setGenerationError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Step 1: Analyze Document
      console.log('Running Step 1: Analyze Document...');
      setGenerationStatus('analyzing');
      
      let response = await fetch(`${supabaseUrl}/functions/v1/analyze-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blueprint_id: id }),
      });

      let data = await response.json();
      if (!data.success) throw new Error(data.error || 'Analysis failed');
      console.log('Step 1 complete:', data);

      // Step 2: Generate Structure
      console.log('Running Step 2: Generate Structure...');
      setGenerationStatus('generating');
      
      response = await fetch(`${supabaseUrl}/functions/v1/generate-structure`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blueprint_id: id }),
      });

      data = await response.json();
      if (!data.success) throw new Error(data.error || 'Structure generation failed');
      console.log('Step 2 complete:', data);

      // Step 3: Search Resources
      console.log('Running Step 3: Search Resources...');
      setGenerationStatus('searching');
      
      response = await fetch(`${supabaseUrl}/functions/v1/search-resources`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blueprint_id: id }),
      });

      data = await response.json();
      if (!data.success) throw new Error(data.error || 'Resource search failed');
      console.log('Step 3 complete:', data);

      // Refresh blueprint data
      await fetchBlueprint();
      
      alert(`🎉 All steps completed successfully!\n\nYour blueprint is ready.`);
      
    } catch (error) {
      console.error('Run all steps error:', error);
      setGenerationError(error.message);
      alert(`❌ Generation failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Initial load and auto-trigger generation if needed
  useEffect(() => {
    if (user && id) {
      fetchBlueprint().then((data) => {
        // DISABLED FOR DEBUGGING - uncomment to enable auto-generation
        // Auto-trigger generation if blueprint is pending and has content to analyze
        // if (data && data.generation_status === 'pending') {
        //   const hasContent = data.description || data.content?.textInput || 
        //                     data.file_metadata?.url || data.content?.fileUpload?.url;
        //   if (hasContent) {
        //     triggerGeneration();
        //   }
        // }
      });
    }
  }, [user, id, fetchBlueprint, triggerGeneration]);

  // Poll for status updates while generating
  useEffect(() => {
    if (!generating && generationStatus !== 'pending') return;
    if (generationStatus === 'completed' || generationStatus === 'failed') return;

    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('blueprints')
        .select('generation_status, generation_error, generated_content')
        .eq('id', id)
        .single();

      if (data) {
        setGenerationStatus(data.generation_status);
        setGenerationError(data.generation_error);
        
        if (data.generation_status === 'completed' || data.generation_status === 'failed') {
          setGenerating(false);
          fetchBlueprint();
        }
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [id, generating, generationStatus, fetchBlueprint]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F4E3] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4A1C]" />
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="min-h-screen bg-[#F8F4E3] flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-600 mb-4">Blueprint not found</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-[#FF4A1C] text-white rounded-xl hover:bg-black transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const content = blueprint.content || {};
  const blueprintName = blueprint.title || content.blueprintName;
  const description = blueprint.description || content.textInput;
  const fileInfo = blueprint.file_metadata || content.fileUpload;
  const generatedContent = blueprint.generated_content;

  const StatusIcon = STATUS_CONFIG[generationStatus]?.icon || Loader2;
  const statusConfig = STATUS_CONFIG[generationStatus] || STATUS_CONFIG.pending;

  return (
    <div className="min-h-screen bg-[#F8F4E3] pt-24 pb-12 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => {
              if (blueprint.class_id) {
                navigate(`/class/${blueprint.class_id}`);
              } else {
                navigate('/dashboard');
              }
            }}
            className="flex items-center gap-2 text-stone-600 hover:text-[#FF4A1C] transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">
              {blueprint.class_id ? 'Back to Class' : 'Back to Dashboard'}
            </span>
          </button>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-[#2A2B2A] mb-2">
                  {blueprintName || 'Untitled Blueprint'}
                </h1>
                <p className="text-stone-500 text-lg">
                  Created on {new Date(blueprint.created_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <div className="p-3 bg-[#FF4A1C]/10 rounded-2xl">
                <FileText className="w-8 h-8 text-[#FF4A1C]" />
              </div>
            </div>

            {/* Generation Status Banner */}
            {generationStatus !== 'completed' && (
              <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${
                generationStatus === 'failed' 
                  ? 'bg-red-50 border border-red-200' 
                  : 'bg-gradient-to-r from-blue-50 via-purple-50 to-orange-50 border border-stone-200'
              }`}>
                <StatusIcon className={`w-5 h-5 ${statusConfig.color} ${statusConfig.animate ? 'animate-pulse' : ''}`} />
                <span className={`font-medium ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                
                {generationStatus === 'failed' && (
                  <button
                    onClick={triggerGeneration}
                    disabled={generating}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#FF4A1C] text-white rounded-lg hover:bg-black transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                    Retry
                  </button>
                )}
              </div>
            )}

            {generationError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                <p className="text-red-600 text-sm">{generationError}</p>
              </div>
            )}

            {/* Blueprint Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-stone-100">
              {content.className && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase">Class</p>
                    <p className="text-[#2A2B2A] font-semibold">{content.className}</p>
                  </div>
                </div>
              )}

              {content.professorName && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase">Professor</p>
                    <p className="text-[#2A2B2A] font-semibold">{content.professorName}</p>
                  </div>
                </div>
              )}

              {blueprint.task_type && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Target className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase">Task Type</p>
                    <p className="text-[#2A2B2A] font-semibold">{blueprint.task_type}</p>
                  </div>
                </div>
              )}

              {blueprint.goal_type && blueprint.goal_type !== 'Not specified' && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Target className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase">Goal</p>
                    <p className="text-[#2A2B2A] font-semibold">{blueprint.goal_type}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Context Section */}
        {(description || fileInfo) && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100 mb-8">
            <h2 className="text-2xl font-bold text-[#2A2B2A] mb-4">Context Provided</h2>
            
            {description && (
              <div className="bg-stone-50 rounded-xl p-6 mb-4">
                <p className="text-stone-700 whitespace-pre-wrap">{description}</p>
              </div>
            )}

            {fileInfo && (
              <div className="bg-[#FF4A1C]/5 border-2 border-[#FF4A1C]/20 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white rounded-lg">
                      <FileText className="w-6 h-6 text-[#FF4A1C]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#2A2B2A]">Uploaded Document</p>
                      <p className="text-sm text-stone-600">{fileInfo.name}</p>
                      <p className="text-xs text-stone-500 mt-1">
                        {(fileInfo.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  {fileInfo.url && (
                    <div className="flex gap-2">
                      <a
                        href={fileInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-white text-[#FF4A1C] rounded-lg hover:bg-stone-50 transition-colors font-medium inline-flex items-center gap-2 border border-[#FF4A1C]/20"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View
                      </a>
                      <a
                        href={fileInfo.url}
                        download
                        className="px-4 py-2 bg-[#FF4A1C] text-white rounded-lg hover:bg-black transition-colors font-medium inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Blueprint Content Placeholder */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100 mb-8">
          <h2 className="text-2xl font-bold text-[#2A2B2A] mb-6">Your Learning Blueprint</h2>
          
          <div className="space-y-6">
            {/* Placeholder Content */}
            <div className="bg-gradient-to-br from-[#FF4A1C]/5 to-purple-50 rounded-2xl p-8 text-center border-2 border-dashed border-stone-200">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <FileText className="w-8 h-8 text-[#FF4A1C]" />
              </div>
              <h3 className="text-xl font-bold text-[#2A2B2A] mb-2">
                Blueprint Generated Successfully!
              </h3>
              <p className="text-stone-600 mb-6 max-w-md mx-auto">
                Your personalized learning blueprint is ready. This is where your customized study plan, 
                resources, and step-by-step guidance will appear.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm">
                <Calendar className="w-4 h-4 text-[#FF4A1C]" />
                <span className="text-sm font-medium text-stone-600">
                  AI-powered content coming soon
                </span>
              </div>
            </div>

            {/* Future sections placeholder */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-stone-50 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-bold text-[#2A2B2A] mb-1">Study Materials</h4>
                <p className="text-sm text-stone-500">Curated resources</p>
              </div>

              <div className="bg-stone-50 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-bold text-[#2A2B2A] mb-1">Practice Problems</h4>
                <p className="text-sm text-stone-500">Hands-on exercises</p>
              </div>

              <div className="bg-stone-50 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <h4 className="font-bold text-[#2A2B2A] mb-1">Study Schedule</h4>
                <p className="text-sm text-stone-500">Time management</p>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Panel */}
        <div className="mt-8 bg-stone-900 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="w-full flex items-center justify-between p-4 text-white hover:bg-stone-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-yellow-400" />
              <span className="font-mono font-bold">DEBUG PANEL</span>
            </div>
            {showDebug ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          
          {showDebug && (
            <div className="p-4 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Step-by-Step Generation Buttons */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-3">STEP-BY-STEP GENERATION (Separate Edge Functions)</h3>
                <p className="text-stone-400 text-xs font-mono mb-3">
                  Each button calls a separate Supabase Edge Function using Claude Haiku 3.5
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={runAnalyzeDocument}
                    disabled={generating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    1. Analyze Document
                  </button>
                  <button
                    onClick={runGenerateStructure}
                    disabled={generating}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    2. Generate Structure
                  </button>
                  <button
                    onClick={runSearchResources}
                    disabled={generating}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    3. Search Resources
                  </button>
                  <button
                    onClick={runAllSteps}
                    disabled={generating}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Run All Steps
                  </button>
                </div>
                <div className="bg-stone-800 p-3 rounded-lg text-xs font-mono space-y-1">
                  <p className="text-blue-400">→ analyze-document: Extracts topics, prerequisites, stores analysis (file preserved)</p>
                  <p className="text-orange-400">→ generate-structure: Creates learning path structure from stored analysis</p>
                  <p className="text-purple-400">→ search-resources: Finds educational resources using Claude's knowledge</p>
                </div>
              </div>

              {/* Blueprint ID */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-2">BLUEPRINT ID</h3>
                <pre className="bg-stone-800 p-3 rounded-lg text-green-400 text-sm overflow-x-auto">
                  {id}
                </pre>
              </div>

              {/* Full Blueprint Record */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-2">FULL BLUEPRINT RECORD (blueprints table)</h3>
                <pre className="bg-stone-800 p-3 rounded-lg text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(blueprint, null, 2)}
                </pre>
              </div>

              {/* Document Analysis */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-2">DOCUMENT ANALYSIS (document_analyses table)</h3>
                {documentAnalysis ? (
                  <pre className="bg-stone-800 p-3 rounded-lg text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(documentAnalysis, null, 2)}
                  </pre>
                ) : (
                  <p className="text-red-400 font-mono text-sm">No document analysis found for this blueprint</p>
                )}
              </div>

              {/* Generated Content */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-2">GENERATED CONTENT (blueprint.generated_content)</h3>
                {blueprint?.generated_content ? (
                  <pre className="bg-stone-800 p-3 rounded-lg text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(blueprint.generated_content, null, 2)}
                  </pre>
                ) : (
                  <p className="text-red-400 font-mono text-sm">No generated content yet</p>
                )}
              </div>

              {/* Blueprint Resources */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-2">BLUEPRINT RESOURCES (blueprint_resources + curated_resources)</h3>
                {blueprintResources.length > 0 ? (
                  <pre className="bg-stone-800 p-3 rounded-lg text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(blueprintResources, null, 2)}
                  </pre>
                ) : (
                  <p className="text-red-400 font-mono text-sm">No resources linked to this blueprint</p>
                )}
              </div>

              {/* Input Content */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-2">INPUT CONTENT (what was sent to AI)</h3>
                <pre className="bg-stone-800 p-3 rounded-lg text-blue-400 text-xs overflow-x-auto whitespace-pre-wrap">
                  {blueprint?.description || blueprint?.content?.textInput || 'No text content'}
                </pre>
                {(blueprint?.file_metadata?.url || blueprint?.content?.fileUpload?.url) && (
                  <p className="text-orange-400 font-mono text-sm mt-2">
                    File URL: {blueprint?.file_metadata?.url || blueprint?.content?.fileUpload?.url}
                  </p>
                )}
              </div>

              {/* Generation Status */}
              <div>
                <h3 className="text-yellow-400 font-mono font-bold mb-2">GENERATION STATUS</h3>
                <div className="bg-stone-800 p-3 rounded-lg text-sm font-mono">
                  <p className="text-white">Status: <span className={
                    generationStatus === 'completed' ? 'text-green-400' :
                    generationStatus === 'failed' ? 'text-red-400' :
                    'text-yellow-400'
                  }>{generationStatus}</span></p>
                  {generationError && (
                    <p className="text-red-400 mt-2">Error: {generationError}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Blueprint;
