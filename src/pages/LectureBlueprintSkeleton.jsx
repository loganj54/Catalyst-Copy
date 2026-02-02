import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, BookOpen, FileText, Loader2, Sparkles, Check, 
  ChevronDown, ChevronUp, AlignLeft, HelpCircle, Table2,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import LatexText from '../components/LatexText';
import { Sidebar } from '../components/dub-ui/Sidebar';

const LectureBlueprintSkeleton = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();

  // State
  const [blueprint, setBlueprint] = useState(null);
  const [lectureStructure, setLectureStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [activeTab, setActiveTab] = useState('prerequisites');
  const [expandedQuizzes, setExpandedQuizzes] = useState({});
  const [showAnswers, setShowAnswers] = useState({});

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

      // Check for existing lecture structure
      const { data: structure } = await supabase
        .from('blueprint_structures')
        .select('*')
        .eq('blueprint_id', id)
        .maybeSingle();

      if (structure?.structure?.structure_type === 'lecture') {
        setLectureStructure(structure.structure);
        // Set first section as active if we have content
        if (structure.structure.lecture_sections?.length > 0) {
          setActiveTab(structure.structure.lecture_sections[0].section_id);
        }
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
      
      // Set first section as active
      if (data.structure.lecture_sections?.length > 0) {
        setActiveTab(data.structure.lecture_sections[0].section_id);
      }

      alert(`Lecture blueprint generated! ${data.metrics?.total_sections || 0} topic sections created.`);
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

  // Build tabs for sidebar
  const tabs = [];
  
  if (lectureStructure) {
    // Prerequisites tab
    if (lectureStructure.prerequisites_section?.learning_units?.length > 0) {
      tabs.push({
        id: 'prerequisites',
        label: 'Prerequisites',
        type: 'prerequisites'
      });
    }

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

              {/* Back to Blueprint */}
              <div className="pt-6 mt-4 border-t border-stone-200 dark:border-stone-700">
                <button
                  onClick={() => navigate(`/blueprint/${id}`)}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-stone-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Blueprint</span>
                </button>
              </div>
            </>
          }
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 ml-3 rounded-2xl shadow-xl ring-1 ring-black/5 overflow-hidden relative bg-white dark:bg-stone-900">
        {/* Header */}
        <div className="relative z-30 w-full bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h1 className="text-xl font-normal text-black dark:text-stone-100 tracking-tight leading-tight truncate">
                    {blueprint?.title || 'Lecture Blueprint'}
                  </h1>
                </div>
                <p className="text-sm text-stone-500 dark:text-stone-400 ml-11">
                  {currentTitle || 'Lecture Study Guide'}
                </p>
              </div>

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

        {/* Scrollable Content */}
        <div id="lecture-scroll-container" className="flex-1 overflow-y-auto">
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
              <div className="space-y-6">
                <div className="mb-8">
                  <h2 className="text-3xl font-light text-stone-900 dark:text-stone-100 mb-2">
                    Prerequisites
                  </h2>
                  <p className="text-stone-500 dark:text-stone-400">
                    {currentContent.data.description || 'Topics you should understand before diving into this lecture.'}
                  </p>
                </div>

                <div className="grid gap-4">
                  {currentContent.data.learning_units?.map((unit, idx) => (
                    <div 
                      key={unit.unit_id || idx}
                      className="bg-stone-50 dark:bg-stone-800 rounded-xl p-6 border border-stone-200 dark:border-stone-700"
                    >
                      <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-2">
                        {unit.topic}
                      </h3>
                      <p className="text-stone-600 dark:text-stone-400 text-sm mb-3">
                        {unit.concept_summary || unit.description}
                      </p>
                      {unit.tutor_guidance && (
                        <p className="text-stone-500 dark:text-stone-500 text-sm italic">
                          {unit.tutor_guidance}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lecture Section Content */}
            {currentContent?.type === 'lecture' && (
              <div className="space-y-8">
                {/* Section Header */}
                <div className="mb-8">
                  <h2 className="text-3xl font-light text-stone-900 dark:text-stone-100 mb-4">
                    {currentContent.data.title}
                  </h2>
                  
                  {/* Why This Matters */}
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-indigo-900 dark:text-indigo-300 mb-1">
                          Why This Matters
                        </h4>
                        <p className="text-indigo-800 dark:text-indigo-200 text-sm">
                          {currentContent.data.why_this_matters}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content Text */}
                <div className="prose prose-stone dark:prose-invert max-w-none">
                  <div className="text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
                    <LatexText 
                      text={currentContent.data.content_text} 
                      unitId={currentContent.data.section_id}
                      context={currentContent.data.title}
                      blueprintId={id}
                    />
                  </div>
                </div>

                {/* Reference Tables */}
                {currentContent.data.reference_tables?.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center shrink-0">
                        <Table2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-2">
                          Reference Tables Needed
                        </h4>
                        <ul className="text-amber-800 dark:text-amber-200 text-sm space-y-1">
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
                  <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleQuiz(currentContent.data.section_id)}
                      className="w-full flex items-center justify-between px-6 py-4 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <HelpCircle className="w-5 h-5 text-stone-500" />
                        <span className="font-medium text-stone-900 dark:text-stone-100">
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
                      <div className="p-6 space-y-6 bg-white dark:bg-stone-900">
                        {currentContent.data.quick_quiz.map((q, idx) => (
                          <div key={q.question_id || idx} className="space-y-3">
                            <div className="flex items-start gap-3">
                              <span className="w-6 h-6 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center text-xs font-medium text-stone-600 dark:text-stone-400 shrink-0">
                                {idx + 1}
                              </span>
                              <div className="flex-1">
                                <p className="text-stone-900 dark:text-stone-100 font-medium mb-2">
                                  <LatexText text={q.question} />
                                </p>
                                
                                {/* Multiple choice options */}
                                {q.options && (
                                  <div className="space-y-2 mb-3">
                                    {q.options.map((option, optIdx) => (
                                      <div 
                                        key={optIdx}
                                        className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400"
                                      >
                                        <span className="w-5 h-5 border border-stone-300 dark:border-stone-600 rounded flex items-center justify-center text-xs">
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
                                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  {showAnswers[q.question_id || `q-${idx}`] ? 'Hide Answer' : 'Show Answer'}
                                </button>

                                {showAnswers[q.question_id || `q-${idx}`] && (
                                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
                                      Answer: <LatexText text={q.correct_answer} />
                                    </p>
                                    <p className="text-sm text-green-700 dark:text-green-400">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LectureBlueprintSkeleton;
