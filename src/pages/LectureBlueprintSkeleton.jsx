import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, FileText, Loader2, Sparkles, Check,
  ChevronDown, ChevronUp, AlignLeft, HelpCircle, Table2,
  MessageSquare, History, Plus, RefreshCw, Play, Star, ExternalLink, Zap, Search, Eye, Database, Calculator, ArrowUpRight, Youtube
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import EquationDisplay from '../components/EquationDisplay';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import LatexText from '../components/LatexText';
import { Sidebar } from '../components/dub-ui/Sidebar';
import ChatInterface from '../components/ChatInterface';
import PracticeProblemsChat from '../components/PracticeProblemsChat';
import { LECTURE_TYPOGRAPHY, getLectureMarkdownComponents } from '../utils/lectureStyles';

const LectureBlueprintSkeleton = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { bgPattern } = useTheme();
  const chatRef = React.useRef(null);

  // State
  const [blueprint, setBlueprint] = useState(null);
  const [lectureStructure, setLectureStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [activeTab, setActiveTab] = useState('prerequisites');
  const [expandedQuizzes, setExpandedQuizzes] = useState({});
  const [showAnswers, setShowAnswers] = useState({});
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [chatTitle, setChatTitle] = useState('Chat with your document');
  const [activeThreadId, setActiveThreadId] = useState(null);

  // Practice Problems state
  const [practiceProblems, setPracticeProblems] = useState({});
  const [showProblemBank, setShowProblemBank] = useState(false);

  // Layout State for Prerequisites (copied from Blueprint.jsx)
  const [savedVideoSelections, setSavedVideoSelections] = useState({});
  const [resourceRatings, setResourceRatings] = useState({});
  const [rerollingUnits, setRerollingUnits] = useState(new Set());
  const [searchingTopics, setSearchingTopics] = useState(new Set());
  const savedVideoUnitsRef = React.useRef(new Set());
  const [topicResources, setTopicResources] = useState({}); // Populated if we fetch resources
  const [topicEquations, setTopicEquations] = useState({}); // Populated if we fetch equations
  const [topicFigures, setTopicFigures] = useState({}); // Populated if we fetch figures

  // Fetch blueprint and existing structure on mount
  useEffect(() => {
    fetchBlueprintData();
  }, [id, session]);

  const fetchBlueprintData = async () => {
    if (!session?.access_token || !id) return;

    setLoading(true);
    try {
      // Fetch blueprint
      const { data: bp, error: bpError } = await supabase
        .from('blueprints')
        .select('*')
        .eq('id', id)
        .single();

      if (bpError) throw bpError;
      setBlueprint(bp);

      // Fetch document if it exists to ensure "View Document" button works
      if (bp.document_id) {
        try {
          const { data: docData } = await supabase
            .from('class_documents')
            .select('*')
            .eq('id', bp.document_id)
            .single();

          if (docData) {
            setBlueprint(prev => ({ ...prev, document: docData }));
          }
        } catch (err) {
          console.error('Error fetching document data:', err);
        }
      }

      // Check for existing lecture structure
      const { data: structure } = await supabase
        .from('blueprint_structures')
        .select('*')
        .eq('blueprint_id', id)
        .maybeSingle();

      if (structure?.structure?.structure_type === 'lecture') {
        setLectureStructure(structure.structure);
        // Default to prerequisites tab first
        setActiveTab('prerequisites');
      }
    } catch (error) {
      console.error('Error fetching blueprint data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate lecture blueprint
  const handleGenerateLectureBlueprint = async () => {
    if (!session?.access_token) return;

    setGenerating(true);
    setGenerationError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-lecture-blueprint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ blueprint_id: id })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      setLectureStructure(data.structure);

      // Default to prerequisites tab
      setActiveTab('prerequisites');

      alert(`Lecture blueprint generated! ${data.metrics?.total_sections || 0} topic sections and ${data.metrics?.total_prerequisites || 0} prerequisites created.`);
    } catch (error) {
      console.error('Generation error:', error);
      setGenerationError(error.message);
      alert(`Generation failed: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Toggle quiz expansion
  const toggleQuiz = (sectionId) => {
    setExpandedQuizzes(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Toggle answer visibility for a question
  const toggleAnswer = (questionId) => {
    setShowAnswers(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  // HELPER FUNCTIONS FROM BLUEPRINT.JSX
  const saveVideoSelection = async (unitId, video) => {
    if (!video?.url || !id) return;
    try {
      const { error } = await supabase
        .from('blueprint_video_selections')
        .upsert({
          blueprint_id: id,
          unit_id: unitId,
          video_url: video.url,
          video_title: video.title || null,
          video_thumbnail_url: video.thumbnail_url || null,
          video_duration: video.duration || null,
          video_channel_name: video.channel_name || video.author || null,
          selected_by: session?.user?.id || null,
        }, { onConflict: 'blueprint_id,unit_id' });

      if (error) {
        console.error('[Blueprint] Failed to save video selection:', error);
      } else {
        setSavedVideoSelections(prev => ({
          ...prev,
          [unitId]: { video_url: video.url, video_title: video.title }
        }));
      }
    } catch (err) {
      console.error('[Blueprint] Error saving video selection:', err);
    }
  };

  const handleRerollVideo = async (unitId, unitResources) => {
    if (!session?.access_token || !unitResources || unitResources.length === 0) return;

    setRerollingUnits(prev => new Set([...prev, unitId]));

    try {
      const visibleVideos = unitResources
        .filter(r => !r.is_hidden && (
          r.type === 'video' ||
          r.type === 'youtube' ||
          r.url?.includes('youtube.com') ||
          r.url?.includes('youtu.be')
        ))
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      if (visibleVideos.length < 2) {
        alert('No more alternative videos available.');
        return;
      }

      const currentVideo = visibleVideos[0];
      const nextVideo = visibleVideos[1];

      // Update backend to hide current and touch next
      if (currentVideo.link_id) {
        await supabase.from('blueprint_topic_resources').update({ is_hidden: true }).eq('id', currentVideo.link_id);
      }
      if (nextVideo.link_id) {
        await supabase.from('blueprint_topic_resources').update({ created_at: new Date().toISOString() }).eq('id', nextVideo.link_id);
      }

      // Update local state
      setTopicResources(prev => {
        const updated = { ...prev };
        if (updated[unitId]) {
          updated[unitId] = updated[unitId].map(r => {
            const isCurrentVideo = currentVideo.link_id ? r.link_id === currentVideo.link_id : r.url === currentVideo.url;
            if (isCurrentVideo) return { ...r, is_hidden: true };
            const isNextVideo = nextVideo.link_id ? r.link_id === nextVideo.link_id : r.url === nextVideo.url;
            if (isNextVideo) return { ...r, created_at: new Date().toISOString() };
            return r;
          });
        }
        return updated;
      });

      saveVideoSelection(unitId, nextVideo);

    } catch (error) {
      console.error('Error rerolling video:', error);
    } finally {
      setRerollingUnits(prev => {
        const next = new Set(prev);
        next.delete(unitId);
        return next;
      });
    }
  };

  const handleTriggerWebhook = (unit) => {
    console.log('Triggering webhook for unit:', unit.topic);
    // Placeholder for actual webhook logic if needed
    alert(`Webhook triggered for: ${unit.topic}`);
  };

  const handleGenerateBlueprint = (unit, type) => {
    console.log('Generating blueprint content for:', unit.topic, type);
    // Placeholder
  };

  const handleViewDocument = async () => {
    if (blueprint?.content?.text) {
      alert('This is a text-based blueprint.');
      return;
    }

    const doc = blueprint?.document || (blueprint?.file_metadata ? {
      ...blueprint.file_metadata,
      file_url: blueprint.file_metadata.url
    } : null);

    if (!doc || !doc.file_url) {
      alert('❌ No document associated with this blueprint.');
      return;
    }

    try {
      window.open(doc.file_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('❌ Failed to open document.\n\nError: ' + error.message);
    }
  };

  // Build tabs for sidebar
  const tabs = [];

  if (lectureStructure) {
    // Prerequisites tab - always show if we have a structure (even if empty, we'll show a message)
    tabs.push({
      id: 'prerequisites',
      label: 'Prerequisites',
      type: 'prerequisites',
      hasContent: lectureStructure.prerequisites_section?.learning_units?.length > 0
    });

    // Lecture section tabs
    lectureStructure.lecture_sections?.forEach((section, idx) => {
      tabs.push({
        id: section.section_id || `section-${idx}`,
        label: section.sidebar_label || `Topic ${idx + 1}`,
        type: 'lecture',
        fullTitle: section.title
      });
    });
  }

  // Get current content based on active tab
  let currentContent = null;
  let currentTitle = '';

  if (activeTab === 'prerequisites' && lectureStructure?.prerequisites_section) {
    currentContent = { type: 'prerequisites', data: lectureStructure.prerequisites_section };
    currentTitle = 'Prerequisites';
  } else if (lectureStructure?.lecture_sections) {
    const section = lectureStructure.lecture_sections.find(
      (s, idx) => (s.section_id || `section-${idx}`) === activeTab
    );
    if (section) {
      currentContent = { type: 'lecture', data: section };
      currentTitle = section.title;
    }
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-stone-100 dark:bg-stone-950">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full py-3 pr-3 pl-0 gap-0 overflow-hidden transition-all duration-300 bg-stone-100 dark:bg-stone-950">
      {/* Sidebar */}
      <div className="hidden lg:flex flex-col w-[250px] bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl ring-1 ring-black/5 overflow-hidden">
        <Sidebar
          className="w-full h-full border-r-0 bg-white dark:bg-stone-900"
          activeClassId={blueprint?.class_id}
          extraContent={
            <>
              {tabs.length > 0 && (
                <div className="pt-2">
                  <div className="px-2 mb-2">
                    <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wider">Lecture Sections</h3>
                  </div>
                  <div className="space-y-0.5">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          const el = document.getElementById('lecture-scroll-container');
                          if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`
                          w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-colors
                          ${activeTab === tab.id
                            ? 'bg-stone-100 dark:bg-stone-800 text-black dark:text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-stone-800 hover:text-gray-900 dark:hover:text-gray-200'}
                        `}
                      >
                        <div className="flex items-center gap-2.5">
                          {tab.type === 'prerequisites' ? (
                            <BookOpen className="w-4 h-4 text-gray-400" />
                          ) : (
                            <AlignLeft className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="truncate">{tab.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tools Section */}
              <div className="pt-6 mt-4">
                <div className="px-2 mb-2">
                  <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wider">Tools</h3>
                </div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setActiveTab('chat');
                      const el = document.getElementById('lecture-scroll-container');
                      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`
                      w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-colors
                      ${activeTab === 'chat'
                        ? 'bg-stone-100 dark:bg-stone-800 text-black dark:text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-stone-800 hover:text-gray-900 dark:hover:text-gray-200'}
                    `}
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <span className="truncate">Chat with your document</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('practice-problems-chat');
                      const el = document.getElementById('lecture-scroll-container');
                      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`
                      w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-colors
                      ${activeTab === 'practice-problems-chat'
                        ? 'bg-stone-100 dark:bg-stone-800 text-black dark:text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-stone-800 hover:text-gray-900 dark:hover:text-gray-200'}
                    `}
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-gray-400" />
                      <span className="truncate">Generate Practice Problems</span>
                    </div>
                  </button>
                </div>
              </div>
            </>
          }
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 ml-3 rounded-2xl shadow-xl ring-1 ring-black/5 overflow-hidden relative bg-white dark:bg-stone-950">

        {/* Background Layer: Grid + Mask (Only visible if pattern is 'grid') */}
        {bgPattern === 'grid' && (
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808025_1px,transparent_1px),linear-gradient(to_bottom,#80808025_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff25_1px,transparent_1px),linear-gradient(to_bottom,#ffffff25_1px,transparent_1px)]"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white dark:from-stone-900 dark:via-transparent dark:to-stone-900"></div>
          </div>
        )}

        {/* Background Layer: Dots (Only visible if pattern is 'dots') */}
        {bgPattern === 'dots' && (
          <div className="absolute inset-0 pointer-events-none z-0 bg-pattern-dots opacity-100"></div>
        )}

        {/* Header */}
        <div className="relative z-30 w-full bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 transition-all duration-300">
          <div className="px-6 py-5 relative">
            {/* View Document Button - Absolute positioned in the corner as requested */}
            {(blueprint?.document || blueprint?.url || blueprint?.content?.text || blueprint?.document_id) && (
              <div className="absolute top-4 right-6 z-20 pointer-events-auto">
                <button
                  onClick={handleViewDocument}
                  className="flex items-center gap-2 px-3 py-1.5 bg-black dark:bg-stone-200 text-white dark:text-black border border-transparent hover:bg-stone-800 dark:hover:bg-white rounded-lg text-xs font-medium transition-all shadow-sm active:scale-95"
                  title={blueprint?.content?.text ? "View Text Input" : (blueprint?.document?.name || "View Document")}
                >
                  {blueprint?.content?.text ? <FileText className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">
                    {blueprint?.content?.text ? 'Text Input' : 'View Document'}
                  </span>
                </button>
              </div>
            )}

            {/* Centered Chat Title (Absolute) */}
            {(activeTab === 'chat' || activeTab === 'practice-problems-chat') && activeThreadId && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 pr-[80px] lg:pr-[330px]">
                <h2 className="text-lg font-medium text-stone-900 dark:text-stone-100 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm px-4 py-1 rounded-full truncate max-w-[40%]">
                  {chatTitle}
                </h2>
              </div>
            )}

            {/* Centered Section Title (Absolute) - for lecture sections */}
            {activeTab !== 'chat' && activeTab !== 'practice-problems-chat' && currentTitle && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 pr-[80px] lg:pr-[330px]">
                <h2 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm px-4 py-1 rounded-full truncate max-w-[40%]">
                  {currentTitle}
                </h2>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 relative z-10 pointer-events-none">
              {/* Left: Title */}
              <div className="min-w-0 pointer-events-auto text-left">
                <h1 className="text-xl font-normal text-black dark:text-stone-100 tracking-tight leading-tight truncate">
                  {blueprint?.title || 'Lecture Blueprint'}
                </h1>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
                {activeTab === 'chat' && (
                  <>
                    <button
                      onClick={() => setShowChatHistory(!showChatHistory)}
                      className={`p-2 rounded-lg transition-colors ${showChatHistory ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400'}`}
                      title="Chat History"
                    >
                      <History className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => chatRef.current?.createNewThread()}
                      className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors text-stone-600 dark:text-stone-400"
                      title="New Chat"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Mobile back button */}
                <button
                  onClick={() => navigate(`/blueprint/${id}`)}
                  className="lg:hidden p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-stone-600 dark:text-stone-400" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div id="lecture-scroll-container" className="flex-1 overflow-y-auto lg:pr-[250px]">
          {activeTab === 'chat' ? (
            <div className="w-full h-full">
              <ChatInterface
                ref={chatRef}
                blueprintId={id}
                documentId={blueprint?.document_id}
                hasDocument={!!blueprint?.document_id}
                initialQuery={blueprint?.content?.text || ""}
                showHistory={showChatHistory}
                onToggleHistory={() => setShowChatHistory(!showChatHistory)}
                onThreadChange={(title, threadId) => {
                  setChatTitle(title);
                  setActiveThreadId(threadId);
                }}
              />
            </div>
          ) : activeTab === 'practice-problems-chat' ? (
            <div className="w-full h-full">
              <PracticeProblemsChat
                ref={chatRef}
                blueprintId={id}
                documentId={blueprint?.document_id}
                hasDocument={!!blueprint?.document_id}
                initialQuery={blueprint?.content?.text || ""}
                tabs={tabs}
                practiceProblems={practiceProblems} // Now using state
                structure={lectureStructure} // Pass the full lecture structure with lecture_sections
                documentAnalysis={null} // Lecture blueprints don't have document analysis
                showProblemBank={showProblemBank} // Now controlled by state
                onToggleProblemBank={() => setShowProblemBank(!showProblemBank)} // Toggle function
                onProblemGenerated={(problem, unitId) => {
                  console.log('[LectureBlueprintSkeleton] Practice problem generated:', problem);
                  // Store in state
                  setPracticeProblems(prev => {
                    const existingProblems = prev[unitId] || [];
                    const currentList = Array.isArray(existingProblems) ? existingProblems : [existingProblems];
                    return {
                      ...prev,
                      [unitId]: [...currentList, { ...problem, solving: false }]
                    };
                  });
                }}
              />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-6 py-8">
              {/* No structure yet - show generation UI */}
              {!lectureStructure && (
                <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-12 text-center">
                  <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                  </div>

                  <h2 className="text-2xl font-semibold text-stone-900 dark:text-stone-100 mb-4">
                    Lecture Document Detected
                  </h2>

                  <p className="text-stone-600 dark:text-stone-400 max-w-md mx-auto mb-8">
                    Generate a structured study guide from your lecture notes with topic sections,
                    key concepts, and practice quizzes.
                  </p>

                  <button
                    onClick={handleGenerateLectureBlueprint}
                    disabled={generating}
                    className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none shadow-md flex items-center gap-3 mx-auto"
                  >
                    {generating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    {generating ? 'Generating...' : 'Generate Lecture Blueprint'}
                  </button>

                  {generationError && (
                    <p className="mt-4 text-red-500 text-sm">{generationError}</p>
                  )}
                </div>
              )}

              {/* Prerequisites Section */}
              {currentContent?.type === 'prerequisites' && (
                <div className="bg-white rounded-2xl p-8 md:p-12 shadow-xl border border-stone-200 dark:border-stone-700 relative z-10">
                  {/* 1. Header */}
                  <div className="space-y-6 mb-16">
                    <h2 className="text-5xl md:text-6xl tracking-tighter font-light text-stone-900 dark:text-stone-100">
                      Prerequisites
                    </h2>
                    <p className="text-base text-stone-700 dark:text-stone-300 max-w-3xl leading-relaxed">
                      {currentContent.data?.description || 'You must be comfortable with the following topics before moving forward.'}
                    </p>
                  </div>

                  {/* 2. Concepts Loop (Sequential) */}
                  <div className="space-y-24 relative transition-all">
                    {currentContent.data?.learning_units?.length > 0 ? (
                      currentContent.data.learning_units.map((unit, index) => {
                        const unitEquations = topicEquations[unit.unit_id] || [];
                        const unitResources = topicResources[unit.unit_id] || [];

                        // Find primary video
                        const visibleVideos = unitResources
                          .filter(r => !r.is_hidden && (
                            r.type === 'video' ||
                            r.type === 'youtube' ||
                            r.url?.includes('youtube.com') ||
                            r.url?.includes('youtu.be')
                          ))
                          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

                        const savedSelection = savedVideoSelections[unit.unit_id];
                        let primaryVideo = null;

                        if (savedSelection?.video_url) {
                          primaryVideo = visibleVideos.find(v => v.url === savedSelection.video_url);
                        }
                        if (!primaryVideo && visibleVideos.length > 0) {
                          primaryVideo = visibleVideos[0];
                          if (!savedSelection && !savedVideoUnitsRef.current.has(unit.unit_id)) {
                            savedVideoUnitsRef.current.add(unit.unit_id);
                            saveVideoSelection(unit.unit_id, primaryVideo);
                          }
                        }

                        const hasMoreVideos = visibleVideos.length > 1;

                        return (
                          <div key={unit.unit_id || index} className="relative group">
                            <div className="space-y-8">

                              {/* Concept Header */}
                              <div>
                                <h3 className="text-4xl md:text-5xl font-light tracking-tight text-stone-800 dark:text-stone-200 mb-6">
                                  {unit.topic}
                                </h3>
                              </div>

                              {/* Solution Walkthrough (if any) */}
                              {unit.solutionWalkthrough && (
                                <div className="mt-12 mb-16">
                                  <div className={LECTURE_TYPOGRAPHY.container}>
                                    <ReactMarkdown components={getLectureMarkdownComponents(LatexText, {
                                      unitId: unit.unit_id,
                                      context: 'Prerequisites',
                                      blueprintId: id,
                                      solutionContext: unit.solutionWalkthrough
                                    })}>
                                      {unit.solutionWalkthrough}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )}

                              {/* Tutor Guidance / Intro Text */}
                              <div className="mb-12 bg-white dark:bg-stone-900 leading-relaxed max-w-none space-y-4 text-base text-stone-700 dark:text-stone-300">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-3 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                    Overview
                                  </span>
                                </div>

                                {unit.tutor_guidance && (
                                  <div className="mb-4 whitespace-pre-wrap">
                                    <LatexText text={unit.tutor_guidance} />
                                  </div>
                                )}

                                {(unit.concept_summary || unit.description) && (
                                  <div className="whitespace-pre-wrap">
                                    <LatexText text={unit.concept_summary || unit.description} />
                                  </div>
                                )}
                              </div>

                              {/* Video Module */}
                              {primaryVideo ? (
                                <div
                                  onClick={() => window.open(primaryVideo.url, '_blank')}
                                  className="bg-white dark:bg-stone-900 rounded-xl border border-gray-300 dark:border-stone-800 shadow-sm overflow-hidden hover:border-gray-400 hover:shadow-md transition-all cursor-pointer group/card"
                                >
                                  <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-start justify-between gap-4">
                                    <h4 className="text-xl font-medium text-stone-900 dark:text-stone-100 line-clamp-1 group-hover/card:text-[#FF4A1C] transition-colors">
                                      {primaryVideo.title}
                                    </h4>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRerollVideo(unit.unit_id, unitResources);
                                      }}
                                      disabled={rerollingUnits.has(unit.unit_id) || !hasMoreVideos}
                                      className={`transition-colors p-1 ${hasMoreVideos ? 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300' : 'text-stone-300 cursor-not-allowed'}`}
                                    >
                                      <RefreshCw className={`w-4 h-4 ${rerollingUnits.has(unit.unit_id) ? 'animate-spin' : ''}`} />
                                    </button>
                                  </div>

                                  <div className="p-5 flex flex-col md:flex-row gap-6">
                                    <div className="flex-shrink-0 w-full md:w-48 space-y-3">
                                      <div className="relative aspect-video rounded-lg overflow-hidden bg-black group/video shadow-sm">
                                        <img
                                          src={`https://img.youtube.com/vi/${primaryVideo.url.split('v=')[1]?.split('&')[0]}/mqdefault.jpg`}
                                          alt={primaryVideo.title}
                                          className="w-full h-full object-cover opacity-90 group-hover/card:opacity-100 transition-opacity"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/card:bg-black/10 transition-colors">
                                          <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white">
                                            <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                                          </div>
                                        </div>
                                      </div>
                                      <div
                                        className="flex items-center justify-center gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {[1, 2, 3, 4, 5].map((star) => {
                                          const rating = resourceRatings[primaryVideo.id || primaryVideo.url] || 0;
                                          return (
                                            <button
                                              key={star}
                                              onClick={() => setResourceRatings(prev => ({ ...prev, [primaryVideo.id || primaryVideo.url]: star }))}
                                              className="focus:outline-none transition-transform hover:scale-110"
                                            >
                                              <Star
                                                className={`w-4 h-4 ${star <= rating ? 'fill-orange-400 text-orange-400' : 'text-stone-300 dark:text-stone-600'}`}
                                              />
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="flex-1 flex flex-col justify-between min-w-0">
                                      <div className="space-y-3">
                                        <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-3">
                                          {primaryVideo.resource_explanation || "No explanation available for this resource."}
                                        </p>
                                      </div>

                                      <div className="flex items-center justify-between pt-4 mt-2">
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-1 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 text-[10px] font-bold uppercase tracking-wider rounded">
                                            YOUTUBE
                                          </span>
                                        </div>
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#FF4A1C] group-hover/card:text-[#e0390c] transition-colors uppercase tracking-wide">
                                          OPEN
                                          <ExternalLink className="w-3 h-3" />
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-stone-800 aspect-video flex flex-col items-center justify-center p-8 text-center space-y-6 bg-stone-50 dark:bg-stone-900/50 group-hover:border-[#FF4A1C]/30 transition-colors">
                                  <div className="w-16 h-16 rounded-full bg-white dark:bg-stone-800 shadow-sm flex items-center justify-center">
                                    <Play className="w-6 h-6 text-stone-300 dark:text-stone-600 ml-1" />
                                  </div>
                                  <div className="space-y-2">
                                    <h3 className="text-xl font-semibold text-stone-900 dark:text-stone-100">No Video Available</h3>
                                    <p className="text-stone-500 dark:text-stone-400 text-base max-w-sm mx-auto">
                                      We couldn't find a curated video for this topic.
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-3 justify-center">
                                    <button
                                      onClick={() => handleGenerateBlueprint(unit, 'database')}
                                      disabled={searchingTopics.has(unit.unit_id)}
                                      className="px-4 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 hover:text-[#FF4A1C] transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                      {searchingTopics.has(unit.unit_id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                      Search Database
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTriggerWebhook(unit);
                                      }}
                                      className="px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border border-transparent rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-sm flex items-center gap-2"
                                    >
                                      <Zap className="w-4 h-4" />
                                      Activate Webhook
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Equations */}
                              <div className="space-y-8">
                                <div>
                                  <h5 className="flex items-center gap-2 w-fit mb-4">
                                    <span className="px-3 py-1.5 bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm rounded-lg text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-2 transition-all duration-300">
                                      <Calculator className="w-3 h-3" />
                                      Equations
                                    </span>
                                  </h5>

                                  {unitEquations && unitEquations.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-3">
                                      <EquationDisplay equations={unitEquations} />
                                    </div>
                                  ) : (
                                    <div className="p-4 text-center border border-stone-200 dark:border-stone-700 rounded-lg bg-stone-50 dark:bg-stone-800/50">
                                      <span className="text-xs text-stone-400">No equations detected</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800">
                        <p className="text-amber-800 dark:text-amber-200">
                          No prerequisites were generated for this lecture.
                          The content may be introductory level or self-contained.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lecture Section Content */}
              {currentContent?.type === 'lecture' && (
                <div className="bg-white rounded-2xl p-8 md:p-12 shadow-xl border border-stone-200 dark:border-stone-700 relative z-10">

                  {/* Section Header */}
                  <div className="space-y-6 mb-16">
                    <h2 className="text-5xl md:text-6xl tracking-tighter font-light text-stone-900 dark:text-stone-100">
                      {currentContent.data.title}
                    </h2>

                    {/* Why This Matters - Styled as Subtitle */}
                    {currentContent.data.why_this_matters && (
                      <p className="text-base text-stone-700 dark:text-stone-300 max-w-3xl leading-relaxed">
                        {currentContent.data.why_this_matters}
                      </p>
                    )}
                  </div>

                  {/* Main Content Text */}
                  <div className="space-y-12">
                    <div className={LECTURE_TYPOGRAPHY.container}>
                      {currentContent.data.content_text ? (
                        <ReactMarkdown components={getLectureMarkdownComponents(LatexText, {
                          unitId: currentContent.data.section_id,
                          context: currentContent.data.title,
                          blueprintId: id
                        })}>
                          {currentContent.data.content_text}
                        </ReactMarkdown>
                      ) : (
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                          <p className="text-red-800 dark:text-red-200 text-sm">
                            No content text was generated for this section. This may be a generation error.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Reference Tables */}
                    {currentContent.data.reference_tables?.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center shrink-0">
                            <Table2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <h4 className="text-xl font-medium text-amber-900 dark:text-amber-300 mb-3">
                              Reference Tables Needed
                            </h4>
                            <ul className="text-amber-800 dark:text-amber-200 text-base space-y-2">
                              {currentContent.data.reference_tables.map((table, idx) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                  {table}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Quiz */}
                    {currentContent.data.quick_quiz?.length > 0 && (
                      <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden mt-12">
                        <button
                          onClick={() => toggleQuiz(currentContent.data.section_id)}
                          className="w-full flex items-center justify-between px-6 py-5 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <HelpCircle className="w-6 h-6 text-stone-500" />
                            <span className="text-xl font-medium text-stone-900 dark:text-stone-100">
                              Quick Quiz ({currentContent.data.quick_quiz.length} questions)
                            </span>
                          </div>
                          {expandedQuizzes[currentContent.data.section_id] ? (
                            <ChevronUp className="w-5 h-5 text-stone-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-stone-400" />
                          )}
                        </button>

                        {expandedQuizzes[currentContent.data.section_id] && (
                          <div className="p-8 space-y-8 bg-white dark:bg-stone-900">
                            {currentContent.data.quick_quiz.map((q, idx) => (
                              <div key={q.question_id || idx} className="space-y-4">
                                <div className="flex items-start gap-4">
                                  <span className="w-8 h-8 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center text-sm font-medium text-stone-600 dark:text-stone-400 shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div className="flex-1">
                                    <p className="text-stone-900 dark:text-stone-100 font-medium text-xl mb-4">
                                      <LatexText text={q.question} />
                                    </p>

                                    {/* Multiple choice options */}
                                    {q.options && (
                                      <div className="space-y-3 mb-4">
                                        {q.options.map((option, optIdx) => (
                                          <div
                                            key={optIdx}
                                            className="flex items-center gap-3 text-base text-stone-600 dark:text-stone-400"
                                          >
                                            <span className="w-6 h-6 border border-stone-300 dark:border-stone-600 rounded flex items-center justify-center text-xs">
                                              {String.fromCharCode(65 + optIdx)}
                                            </span>
                                            <LatexText text={option} />
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Show/Hide Answer */}
                                    <button
                                      onClick={() => toggleAnswer(q.question_id || `q-${idx}`)}
                                      className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                      {showAnswers[q.question_id || `q-${idx}`] ? 'Hide Answer' : 'Show Answer'}
                                    </button>

                                    {showAnswers[q.question_id || `q-${idx}`] && (
                                      <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                        <p className="text-base font-medium text-green-800 dark:text-green-300 mb-2">
                                          Answer: <LatexText text={q.correct_answer} />
                                        </p>
                                        <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed">
                                          <LatexText text={q.explanation} />
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LectureBlueprintSkeleton;
