import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
    Send, Loader2, MessageSquare, Plus, Trash2, Clock, Folder, Library,
    ArrowRight, Paperclip, X, ChevronDown, ChevronUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { supabase } from '../lib/supabase';

const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="mt-4 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-stone-50/50 dark:bg-stone-900/50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
            >
                <span className="font-medium text-stone-900 dark:text-stone-100">{title}</span>
                {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-stone-500" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-stone-500" />
                )}
            </button>
            {isOpen && (
                <div className="px-5 pb-5 pt-0 animate-in slide-in-from-top-2 duration-200">
                    <div className="pt-4 border-t border-stone-200 dark:border-stone-800">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};

const truncateText = (text, maxWords) => {
    if (!text) return '';
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
};

const cleanDescription = (text) => {
    if (!text) return '';
    // Find the first colon or semicolon and return text after it
    const match = text.match(/[:;]\s*(.+)$/);
    return match ? match[1] : text;
};

const PracticeProblemsChat = forwardRef(({
    documentId,
    blueprintId,
    contextTitle = "Document Context",
    hasDocument = true,
    initialQuery = "",
    tabs = [],
    practiceProblems = {},
    structure = {},
    documentAnalysis = null, // Contains raw_analysis.sections with problem data
    showProblemBank = false,
    onToggleProblemBank,
    onProblemGenerated // Callback to update Problem Bank when a new problem is generated
}, ref) => {

    // Thread state
    const [threads, setThreads] = useState([]);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [isLoadingThreads, setIsLoadingThreads] = useState(false);

    // View state
    const [activeProblemId, setActiveProblemId] = useState(null); // ID of the problem currently being viewed


    // Chat state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState(initialQuery);
    const [isLoading, setIsLoading] = useState(false);

    // Empty View condition: No active thread selected AND no active problem selected
    const isEmptyView = !activeThreadId && !activeProblemId;

    const [fetchedDocumentId, setFetchedDocumentId] = useState(null);
    const [isResolvingDocId, setIsResolvingDocId] = useState(false);
    const [classId, setClassId] = useState(null);
    const [useClassContext, setUseClassContext] = useState(false);
    const [selectedSections, setSelectedSections] = useState(new Set()); // State for selected practice sections
    const [selectedProblems, setSelectedProblems] = useState(new Set()); // State for selected problems
    const [generatedProblem, setGeneratedProblem] = useState(null); // Stores the most recently generated problem

    const activeDocumentId = documentId || fetchedDocumentId;

    // Extract problems from documentAnalysis with their full context
    const extractedProblems = React.useMemo(() => {
        const sections = documentAnalysis?.raw_analysis?.sections || [];
        const structureSections = structure?.content_sections || structure?.learning_structure?.content_sections || [];

        return sections
            .filter(section => section.problem_statement) // Only include sections with actual problems
            .map(section => {
                // Find matching structure section for the label
                const matchingTab = tabs.find(t =>
                    t.id === section.section_id ||
                    t.id === section.section_id?.replace('_walkthroughs', '') ||
                    section.section_id?.includes(t.id)
                );

                return {
                    id: section.section_id,
                    label: matchingTab?.label || section.section_id || 'Problem',
                    fullTitle: matchingTab?.fullTitle || section.section_id,
                    description: cleanDescription(matchingTab?.unit_title || matchingTab?.topic || matchingTab?.description || matchingTab?.learning_objective || section.content_summary || section.concept_summary || section.summary || section.description || ''),
                    problem_statement: section.problem_statement,
                    given_values: section.given_values || [],
                    solution_approach: section.solution_approach || [],
                    common_mistakes: section.common_mistakes || [],
                    concepts_covered: section.concepts_covered || [],
                    difficulty_level: section.difficulty_level
                };
            });
    }, [documentAnalysis, structure, tabs]);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const mainInputRef = useRef(null);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        createNewThread: () => createNewThread(),
    }));

    // Initial load
    useEffect(() => {
        if (blueprintId) {
            resolveDocumentId();
            fetchThreads();
        }
    }, [blueprintId]);

    // Load messages when thread changes
    useEffect(() => {
        if (activeThreadId) {
            fetchMessages(activeThreadId);
        } else {
            setMessages([]);
        }
    }, [activeThreadId]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading, input, activeThreadId]);

    // Lock scroll on main container when problem bank sidebar is open
    useEffect(() => {
        const scrollContainer = document.getElementById('main-scroll-container');
        if (scrollContainer) {
            if (showProblemBank) {
                scrollContainer.style.overflow = 'hidden';
            }
        }
    }, [showProblemBank]);

    // --- DATA FETCHING ---
    const resolveDocumentId = async () => {
        if (documentId || fetchedDocumentId) return;
        setIsResolvingDocId(true);
        try {
            const { data: bpData } = await supabase
                .from('blueprints')
                .select('document_id, file_metadata, class_id')
                .eq('id', blueprintId)
                .single();

            if (bpData?.document_id) {
                setFetchedDocumentId(bpData.document_id);
                if (bpData.class_id) setClassId(bpData.class_id);
                return;
            }

            if (bpData?.class_id) setClassId(bpData.class_id);

            if (bpData?.file_metadata && bpData.class_id) {
                const { data: docData } = await supabase
                    .from('class_documents')
                    .select('id')
                    .eq('class_id', bpData.class_id)
                    .eq('name', bpData.file_metadata.name)
                    .eq('file_size', bpData.file_metadata.size)
                    .maybeSingle();

                if (docData?.id) {
                    setFetchedDocumentId(docData.id);
                    return;
                }
            }

            const { data: daData } = await supabase
                .from('document_analyses')
                .select('document_id')
                .eq('blueprint_id', blueprintId)
                .maybeSingle();

            if (daData?.document_id) {
                setFetchedDocumentId(daData.document_id);
                return;
            }
        } catch (e) {
            console.error("Error resolving doc ID:", e);
        } finally {
            setIsResolvingDocId(false);
        }
    };

    const fetchThreads = async () => {
        if (!blueprintId) return;
        setIsLoadingThreads(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('chat_threads')
                .select('*')
                .eq('blueprint_id', blueprintId)
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setThreads(data || []);
            setThreads(data || []);
            // setActiveThreadId(null); // REMOVED: Do not reset active thread on fetch

        } catch (error) {
            console.error("Error fetching threads:", error);
        } finally {
            setIsLoadingThreads(false);
        }
    };

    const fetchMessages = async (threadId) => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('thread_id', threadId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                setMessages(data);
            } else {
                setMessages([{
                    role: 'assistant',
                    content: hasDocument
                        ? "Hello! I've read your document. Ask me anything about it!"
                        : "Hello! I'm here to help. Ask me anything!"
                }]);
            }
        } catch (error) {
            console.error("Error fetching messages:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const createNewThread = async () => {
        setActiveThreadId(null);
        setActiveProblemId(null);
        setMessages([]);
        setInput('');
        if (showProblemBank && onToggleProblemBank) {
            onToggleProblemBank(); // Close sidebar when starting new
        }
    };

    const deleteThread = async (e, threadId) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this conversation?")) return;

        try {
            const { error } = await supabase
                .from('chat_threads')
                .delete()
                .eq('id', threadId);

            if (error) throw error;

            setThreads(threads.filter(t => t.id !== threadId));
            if (activeThreadId === threadId) {
                setActiveThreadId(null);
                setMessages([]);
            }
        } catch (error) {
            console.error("Error deleting thread:", error);
        }
    };

    // --- MESSAGING ---

    const handleSend = async (manualContent = null) => {
        const contentToSend = (typeof manualContent === 'string' ? manualContent : input).trim();
        if (!contentToSend || isLoading) return;

        let currentThreadId = activeThreadId;
        if (!currentThreadId) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const { data, error } = await supabase
                    .from('chat_threads')
                    .insert({
                        blueprint_id: blueprintId,
                        user_id: user.id,
                        blueprint_id: blueprintId,
                        user_id: user.id,
                        title: contentToSend.substring(0, 30) + '...'
                    })
                    .select()
                    .single();

                if (error) throw error;

                setThreads([data, ...threads]);
                setActiveThreadId(data.id);
                currentThreadId = data.id;
            } catch (err) {
                console.error("Failed to create thread on send:", err);
                return;
            }
        }

        const userMessageContent = contentToSend;
        const userMessage = { role: 'user', content: userMessageContent };

        setMessages(prev => [...prev, userMessage]);
        setInput('');

        if (inputRef.current) inputRef.current.style.height = 'auto';
        if (mainInputRef.current) mainInputRef.current.style.height = 'auto';

        setIsLoading(true);

        try {
            await supabase.from('chat_messages').insert({
                thread_id: currentThreadId,
                role: 'user',
                content: userMessageContent
            });

            const { data: { session } } = await supabase.auth.getSession();
            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-document`;
            const messageHistory = [...messages, userMessage];

            const res = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    document_id: activeDocumentId,
                    messages: messageHistory,
                    current_message: userMessageContent,
                    class_id: classId,
                    include_class_context: useClassContext
                })
            });

            if (!res.ok) throw new Error("Failed to fetch response");

            const streamReader = res.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessageContent = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

            while (true) {
                const { done, value } = await streamReader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                assistantMessageContent += chunk;

                setMessages(prev => {
                    const newMsg = [...prev];
                    newMsg[newMsg.length - 1] = {
                        role: 'assistant',
                        content: assistantMessageContent,
                        isStreaming: true
                    };
                    return newMsg;
                });
            }

            await supabase.from('chat_messages').insert({
                thread_id: currentThreadId,
                role: 'assistant',
                content: assistantMessageContent
            });

            setMessages(prev => {
                const newMsg = [...prev];
                newMsg[newMsg.length - 1] = {
                    role: 'assistant',
                    content: assistantMessageContent,
                    isStreaming: false
                };
                return newMsg;
            });

            await supabase.from('chat_threads')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', currentThreadId);

            // Update thread list locally to show latest on top without refetching (prevents UI glitches)
            setThreads(prev => {
                const existing = prev.find(t => t.id === currentThreadId);
                // If existing thread, move to top and update time
                if (existing) {
                    const others = prev.filter(t => t.id !== currentThreadId);
                    return [{ ...existing, updated_at: new Date().toISOString() }, ...others];
                }
                // If strictly new (just added in this function), it is already at top?
                // Logic at line 256 added it to top. 
                // But wait, line 256 did: setThreads([data, ...threads]);
                // So if it was new, it's there.
                // If it was existing, we just updated it.
                return prev;
            });

        } catch (err) {
            console.error("Chat error:", err);
            setMessages(prev => [...prev, {
                role: 'system',
                content: `Error: ${err.message}`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInput = (e) => {
        const target = e.target;
        target.style.height = 'auto';
        target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
        setInput(target.value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Generate practice problem and save to Problem Bank (not chat history)
    const handleGeneratePracticeProblem = async (selectedProblemData) => {
        setIsLoading(true);
        setGeneratedProblem(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();

            // Use the first selected problem's section_id as unit_id
            const unitId = selectedProblemData[0]?.id || 'generated';

            // Build context from selected problems
            const original_problem = selectedProblemData.map(p => p.problem_statement).join('\n\n');
            const topic = selectedProblemData.map(p => p.label).join(', ');

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-practice-problem`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        topic,
                        original_problem,
                        unit_id: unitId,
                        blueprint_id: blueprintId,
                        context: {
                            concepts: selectedProblemData.flatMap(p => p.concepts_covered || []),
                            source_problems: selectedProblemData.length
                        }
                    })
                }
            );

            const result = await response.json();

            if (result.success && result.problem) {
                // Call parent callback to update Problem Bank
                onProblemGenerated?.(result.problem, unitId);
                // Show the generated problem in the UI
                setGeneratedProblem(result.problem);
                // Set as active problem to switch view
                setActiveProblemId(unitId);
                // Clear selection after successful generation
                setSelectedProblems(new Set());
            } else {
                console.error('Failed to generate problem:', result.error);
            }
        } catch (error) {
            console.error('Failed to generate problem:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // =================================================================================================
    // MAIN RENDER
    // =================================================================================================
    return (
        <div className="w-full h-full relative overflow-hidden flex flex-col">

            {/* Problem Bank Sidebar */}
            <div className={`absolute top-0 right-0 h-full w-80 bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 transform transition-transform duration-300 z-[60] ${showProblemBank ? 'translate-x-0 shadow-2xl' : 'translate-x-full shadow-none'}`}>
                <div className="flex flex-col h-full bg-white dark:bg-stone-900">
                    <div className="px-6 pb-6 pt-10">
                        <h2 className="text-xl font-normal text-black dark:text-white tracking-tight leading-tight">Problem Bank</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto pt-5 px-3 space-y-0.5">
                        {Object.keys(practiceProblems).length === 0 ? (
                            <div className="px-2 py-2 text-sm text-stone-400 italic">
                                No practice problems yet.
                            </div>
                        ) : (
                            Object.entries(practiceProblems).flatMap(([unitId, problems]) => {
                                // Handle if problems is an array or single object
                                const problemList = Array.isArray(problems) ? problems : [problems];

                                return problemList.map((prob, idx) => {
                                    // Resolve unit title
                                    let unitTitle = "Unknown Section";
                                    if (structure?.content_sections) {
                                        for (const section of structure.content_sections) {
                                            const unit = section.learning_units?.find(u => u.unit_id === unitId);
                                            if (unit) {
                                                unitTitle = unit.topic;
                                                break;
                                            }
                                        }
                                    }

                                    // Make a unique ID (if we had real IDs use them, else composite)
                                    const itemKey = `${unitId}-${idx}`;
                                    const isActive = activeProblemId === unitId; // Simple check for now

                                    return (
                                        <button
                                            key={itemKey}
                                            onClick={() => {
                                                setActiveProblemId(unitId);
                                                onToggleProblemBank(); // Close sidebar on selection
                                            }}
                                            className={`
                                                w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-colors text-left group
                                                ${isActive
                                                    ? 'bg-stone-100 text-black'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                            `}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Library className="w-4 h-4 text-gray-400 group-hover:text-gray-500 shrink-0" />
                                                <span className="truncate">
                                                    {prob.problem_name || unitTitle || `Problem ${idx + 1}`}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 shrink-0 ml-2 hidden group-hover:inline">
                                                {unitTitle}
                                            </span>
                                        </button>
                                    );
                                });
                            })
                        )}
                    </div>

                    {/* New Problem Button in Sidebar */}
                    <div className="p-4 pb-6 border-t border-stone-100 dark:border-stone-800">
                        <button
                            onClick={() => {
                                setActiveThreadId(null);
                                setActiveProblemId(null);
                                onToggleProblemBank(); // Close sidebar to show generator
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-stone-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            <Plus className="w-4 h-4" />
                            New Problem
                        </button>
                    </div>
                </div>
            </div>

            {/* Overlay Backdrop REMOVED */}

            {/* EMPTY STATE */}
            {isEmptyView ? (
                <div className="w-full h-full flex flex-col items-center overflow-y-auto pl-4 pr-[84px] lg:pr-[334px] bg-transparent animate-in fade-in duration-500 pt-[max(2rem,calc(50vh-20.25rem))]">

                    {/* Header */}
                    <div className="text-center mb-10">
                        <h1 className="inline-block text-4xl md:text-5xl text-black dark:text-white tracking-tight font-display mb-3 pb-6">
                            Ready for some practice?
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                            Select problems to generate a custom practice scenario.
                        </p>
                    </div>

                    {/* Main Input Card */}
                    <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 relative z-10 opacity-100">
                        <div className="rounded-2xl shadow-xl border border-gray-300 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
                            <div className="p-5">
                                <div className="border border-stone-200 dark:border-stone-800 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 tracking-wider">
                                            Base practice problem on...
                                        </h2>
                                        <button
                                            onClick={() => {
                                                if (selectedProblems.size === extractedProblems.length) {
                                                    setSelectedProblems(new Set());
                                                } else {
                                                    setSelectedProblems(new Set(extractedProblems.map(p => p.id)));
                                                }
                                            }}
                                            className="text-xs font-medium text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
                                        >
                                            {selectedProblems.size === extractedProblems.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>

                                    {extractedProblems.length === 0 ? (
                                        <div className="text-center py-8 text-stone-400">
                                            <p className="text-sm">No problems found in this blueprint.</p>
                                            <p className="text-xs mt-1">Problems will appear here once the document is analyzed.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                                            {extractedProblems.map((problem) => {
                                                const isSelected = selectedProblems.has(problem.id);
                                                return (
                                                    <button
                                                        key={problem.id}
                                                        onClick={() => {
                                                            setSelectedProblems(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(problem.id)) next.delete(problem.id);
                                                                else next.add(problem.id);
                                                                return next;
                                                            });
                                                        }}
                                                        className="flex items-center gap-4 py-2 px-1 transition-all text-left group"
                                                    >
                                                        <div className={`
                                                            w-3 h-3 rounded-full border flex items-center justify-center transition-all flex-shrink-0
                                                            ${isSelected
                                                                ? 'border-black dark:border-white bg-black dark:bg-white'
                                                                : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 group-hover:border-stone-400 dark:group-hover:border-stone-500'}
                                                        `}>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={`text-sm transition-colors truncate text-stone-900 dark:text-stone-100 ${isSelected ? 'font-medium' : ''}`}>
                                                                {problem.label}
                                                            </p>
                                                            <p className="text-xs text-stone-400 dark:text-stone-500 truncate">
                                                                {truncateText(problem.description || problem.fullTitle, 10)}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Bottom Bar */}
                            <div className="px-5 pb-5">
                                <div className="w-full border-t border-stone-200 dark:border-stone-800 mb-5" />
                                <button
                                    onClick={() => {
                                        if (selectedProblems.size === 0 || isLoading) return;

                                        // Build rich context with full problem data
                                        const selectedProblemData = extractedProblems.filter(p => selectedProblems.has(p.id));

                                        // Call the dedicated problem generation function (saves to Problem Bank, not chat)
                                        handleGeneratePracticeProblem(selectedProblemData);
                                    }}
                                    disabled={selectedProblems.size === 0 || isLoading || extractedProblems.length === 0}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium text-sm border border-transparent shadow-sm hover:opacity-80 transition-all ${(selectedProblems.size === 0 || extractedProblems.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Generating practice problem...
                                        </>
                                    ) : (
                                        <>
                                            <span>
                                                {extractedProblems.length === 0
                                                    ? 'No problems available'
                                                    : selectedProblems.size === 0
                                                        ? 'Select problems above'
                                                        : selectedProblems.size === 1
                                                            ? 'Generate practice problem based on 1 problem'
                                                            : selectedProblems.size === extractedProblems.length
                                                                ? 'Generate practice problem based on all problems'
                                                                : `Generate practice problem based on ${selectedProblems.size} problems`
                                                }
                                            </span>
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                </div >
            ) : activeProblemId ? (
                /* PRACTICE PROBLEM VIEW */
                <div className="w-full h-full flex flex-col items-center overflow-y-auto px-6 py-10 lg:pr-[334px] bg-transparent animate-in fade-in duration-500 relative z-10">
                    {(() => {
                        // Find the problem data
                        const problems = practiceProblems[activeProblemId];
                        const problem = Array.isArray(problems) ? problems[0] : problems; // Just showing first for now if multiple

                        // Resolve unit title
                        let unitTitle = "Practice Problem";
                        // Try to find in structure
                        if (structure?.content_sections) {
                            for (const section of structure.content_sections) {
                                const unit = section.learning_units?.find(u => u.unit_id === activeProblemId);
                                if (unit) {
                                    unitTitle = unit.topic;
                                    break;
                                }
                            }
                        }

                        if (!problem) return (
                            <div className="flex flex-col items-center justify-center h-full text-stone-500">
                                <p>Problem not found.</p>
                                <button onClick={() => setActiveProblemId(null)} className="mt-4 text-[#FF4A1C]">Back to generator</button>
                            </div>
                        );

                        return (
                            <div className="w-full max-w-4xl space-y-8 pb-20">
                                {/* Header */}
                                <div className="border-b border-stone-200 dark:border-stone-700 pb-6">
                                    <h1 className="text-3xl font-display font-medium text-stone-900 dark:text-stone-100">
                                        {problem.problem_name || unitTitle}
                                    </h1>
                                    <p className="text-sm text-stone-400 dark:text-stone-500 mt-2">
                                        {new Date().toLocaleDateString()}
                                    </p>
                                </div>

                                {/* Problem Content */}
                                <div className="bg-white dark:bg-stone-900 rounded-2xl p-8 border border-stone-200 dark:border-stone-800 shadow-sm">
                                    <div className="prose prose-lg max-w-none dark:prose-invert text-stone-800 dark:text-stone-200 leading-relaxed">
                                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {problem.practice_problem}
                                        </ReactMarkdown>
                                    </div>

                                    {/* Hints Section */}
                                    {problem.hints && problem.hints.length > 0 && (
                                        <CollapsibleSection title="Hints" defaultOpen={false}>
                                            <ul className="list-disc list-outside ml-4 space-y-2">
                                                {problem.hints.map((hint, idx) => (
                                                    <li key={idx} className="text-stone-600 dark:text-stone-300">
                                                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                            {hint}
                                                        </ReactMarkdown>
                                                    </li>
                                                ))}
                                            </ul>
                                        </CollapsibleSection>
                                    )}

                                    {/* Solution Section */}
                                    {(problem.solution_steps?.length > 0 || problem.final_answer) && (
                                        <CollapsibleSection title="Solution" defaultOpen={false}>
                                            <div className="space-y-6">
                                                {problem.solution_steps?.map((step, idx) => (
                                                    <div key={idx} className="flex gap-4">
                                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-xs font-bold text-stone-500">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="flex-1 text-stone-600 dark:text-stone-300">
                                                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                                {step}
                                                            </ReactMarkdown>
                                                        </div>
                                                    </div>
                                                ))}

                                                {problem.final_answer && (
                                                    <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-800">
                                                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-100 dark:border-green-800/30">
                                                            <p className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400 mb-1">Final Answer</p>
                                                            <div className="text-green-900 dark:text-green-100 font-medium">
                                                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                                    {problem.final_answer}
                                                                </ReactMarkdown>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </CollapsibleSection>
                                    )}


                                </div>


                            </div>
                        );
                    })()}
                </div>
            ) : (
                /* ACTIVE CHAT STATE */
                <div className="w-full h-full flex flex-col bg-transparent">
                    {/* Chat Header REMOVED - Controlled by parent */}

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto pl-6 py-6 space-y-6 pr-[92px] lg:pr-[342px]">
                        {/* Same message list code ... */}
                        <div className="max-w-4xl mx-auto w-full space-y-6">
                            {messages.map((msg, idx) => {
                                const isUser = msg.role === 'user';
                                const isSystem = msg.role === 'system';
                                if (isSystem) return <div key={idx} className="flex justify-center"><span className="text-xs bg-stone-100 text-stone-500 px-3 py-1 rounded-full">{msg.content}</span></div>;
                                return (
                                    <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl px-6 py-4 text-base leading-relaxed shadow-sm ${isUser ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200'}`}>
                                            {isUser ? msg.content : <div className="prose prose-base max-w-none dark:prose-invert break-words"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown></div>}
                                        </div>
                                    </div>
                                );
                            })}
                            {isLoading && !messages[messages.length - 1]?.isStreaming && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl px-6 py-4 shadow-sm flex items-center gap-3">
                                        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                                        <span className="text-sm text-stone-500">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Bottom Input Area */}
                    <div className="pl-4 py-4 bg-transparent pr-[84px] lg:pr-[334px]">
                        <div className="max-w-4xl mx-auto w-full p-2 bg-white dark:bg-stone-900 border border-gray-300 dark:border-stone-700 rounded-2xl shadow-xl focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10 transition-all">
                            <div className="relative flex items-end">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={handleInput}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask a follow-up question..."
                                    disabled={isLoading}
                                    rows={1}
                                    className="w-full pl-4 pr-12 py-3 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-base text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 max-h-[200px] overflow-y-auto"
                                    style={{ minHeight: '48px' }}
                                />
                                <button onClick={handleSend} disabled={!input.trim() || isLoading} className="absolute right-2 bottom-2 p-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-80 transition-all">
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
});

export default PracticeProblemsChat;
