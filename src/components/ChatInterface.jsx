import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
    Send, Loader2, MessageSquare, Plus, Trash2, Clock, Folder, Library,
    ArrowRight, Paperclip, X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { supabase } from '../lib/supabase';

const ChatInterface = forwardRef(({
    documentId,
    blueprintId,
    contextTitle = "Document Context",
    hasDocument = true,
    initialQuery = "",
    onThreadChange, // Callback (title, threadId)
    showHistory: propShowHistory,
    onToggleHistory: propOnToggleHistory
}, ref) => {
    // History Sidebar State
    const [internalShowHistory, setInternalShowHistory] = useState(false);

    // Determine if controlled or uncontrolled
    const isControlled = typeof propShowHistory !== 'undefined';
    const showHistory = isControlled ? propShowHistory : internalShowHistory;

    // Helper to toggle
    const toggleHistory = () => {
        if (isControlled && propOnToggleHistory) {
            propOnToggleHistory();
        } else {
            setInternalShowHistory(prev => !prev);
        }
    };

    // Helper to set explicit
    const setHistoryOpen = (isOpen) => {
        if (isControlled && propOnToggleHistory) {
            // Only if the clear intent matches (e.g. force close)
            // For simple toggle, just toggle. But to "Close" explicitly:
            if (showHistory !== isOpen) propOnToggleHistory();
        } else {
            setInternalShowHistory(isOpen);
        }
    };

    // Thread state
    const [threads, setThreads] = useState([]);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [isLoadingThreads, setIsLoadingThreads] = useState(false);

    // Chat state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState(initialQuery);
    const [isLoading, setIsLoading] = useState(false);

    // Empty View condition: No active thread selected
    const isEmptyView = !activeThreadId;

    const [fetchedDocumentId, setFetchedDocumentId] = useState(null);
    const [isResolvingDocId, setIsResolvingDocId] = useState(false);
    const [classId, setClassId] = useState(null);
    const [useClassContext, setUseClassContext] = useState(false);

    const activeDocumentId = documentId || fetchedDocumentId;

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const mainInputRef = useRef(null);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        createNewThread: () => createNewThread(),
        toggleHistory: () => toggleHistory(),
    }));

    // Notify parent of thread changes
    useEffect(() => {
        if (onThreadChange) {
            if (activeThreadId) {
                const currentThread = threads.find(t => t.id === activeThreadId);
                onThreadChange(currentThread?.title || 'New Conversation', activeThreadId);
            } else {
                onThreadChange('AI Assistant', null);
            }
        }
    }, [activeThreadId, threads, onThreadChange]);

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

    // Lock scroll on main container when history sidebar is open
    useEffect(() => {
        const scrollContainer = document.getElementById('main-scroll-container');
        if (scrollContainer) {
            if (showHistory) {
                scrollContainer.style.overflow = 'hidden';
            } else {
                // If we are in chat mode (which controls this component), the parent might expect hidden
                // But this specific effect handles history toggle interactions.
                // We'll let the parent manage the main container scroll state for "chat mode".
                // Just reset if we messed with it, but check parent implementation.
                // Actually, for this specific component, we want to ensure the MAIN container doesn't scroll if history is open.
                // Implementation in Blueprint.jsx handles the global chat mode scroll lock.
            }
        }
    }, [showHistory]);

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
        setMessages([]);
        setInput('');
        setHistoryOpen(false); // Close sidebar when starting new
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

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        let currentThreadId = activeThreadId;
        if (!currentThreadId) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const { data, error } = await supabase
                    .from('chat_threads')
                    .insert({
                        blueprint_id: blueprintId,
                        user_id: user.id,
                        title: input.trim().substring(0, 30) + '...'
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

        const userMessageContent = input.trim();
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

    const handleThreadClick = (threadId) => {
        setActiveThreadId(threadId);
        setHistoryOpen(false); // Close history when selecting a thread
    };

    // =================================================================================================
    // MAIN RENDER WITH INLINED HISTORY SIDEBAR
    // =================================================================================================
    return (
        <div className="w-full h-full relative overflow-hidden flex flex-col">

            {/* Sidebar Overlay (Inlined) */}
            <div className={`absolute top-0 right-0 h-full w-80 bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 transform transition-transform duration-300 z-[60] ${showHistory ? 'translate-x-0 shadow-2xl' : 'translate-x-full shadow-none'}`}>
                <div className="flex flex-col h-full bg-white dark:bg-stone-900">
                    <div className="px-6 pb-6 pt-10">
                        <h2 className="text-xl font-normal text-black dark:text-white tracking-tight leading-tight">Past threads</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto pt-5 px-3 space-y-0.5">
                        {threads.length === 0 ? (
                            <div className="px-2 py-2 text-sm text-stone-400 italic">
                                No history yet.
                            </div>
                        ) : (
                            threads.map(thread => (
                                <button
                                    key={thread.id}
                                    onClick={() => handleThreadClick(thread.id)}
                                    className={`
                                        w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-colors text-left group
                                        ${activeThreadId === thread.id
                                            ? 'bg-stone-100 text-black'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                    `}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <MessageSquare className="w-4 h-4 text-gray-400 group-hover:text-gray-500 shrink-0" />
                                        <span className="truncate">{thread.title || 'Conversation'}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                                        {new Date(thread.updated_at).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                    {/* New Chat Button in Sidebar */}
                    <div className="p-4 pb-6 border-t border-stone-100 dark:border-stone-800">
                        <button
                            onClick={createNewThread}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-stone-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            <Plus className="w-4 h-4" />
                            New Chat
                        </button>
                    </div>
                </div>
            </div>

            {/* Overlay Backdrop REMOVED */}

            {/* EMPTY STATE */}
            {isEmptyView ? (
                <div className="w-full h-full flex flex-col items-center justify-center pl-4 py-4 pt-6 pr-[84px] lg:pr-[334px] bg-transparent animate-in fade-in duration-500">

                    {/* Header */}
                    <div className="text-center mb-10">
                        <h1 className="inline-block text-4xl md:text-5xl text-black dark:text-white tracking-tight font-display mb-3">
                            Ask anything about your document
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                            I've analyzed your materials. What would you like to know?
                        </p>
                    </div>

                    {/* Main Input Card */}
                    <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 relative z-10">
                        <div className="rounded-2xl shadow-xl border border-gray-300 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
                            <div className="p-4 space-y-4">
                                <div className="h-[172px]">
                                    <textarea
                                        ref={mainInputRef}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Or add any specific context, problem details, or questions here..."
                                        disabled={isLoading}
                                        className="w-full h-full p-3 bg-white dark:bg-stone-800 border border-gray-200 dark:border-stone-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:border-gray-400 dark:focus:border-stone-500 focus:ring-0 leading-relaxed placeholder:text-gray-400 dark:placeholder:text-stone-500"
                                        autoFocus
                                    />
                                </div>

                                {/* Bottom Bar */}
                                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-stone-700">
                                    <div className="flex items-center gap-2">

                                        {/* HISTORY TOGGLE BUTTON (As Requested) */}
                                        <button
                                            onClick={() => toggleHistory()}
                                            className={`flex items-center gap-2 px-3 py-2 border rounded-lg font-medium text-sm transition-all shadow-sm ${showHistory
                                                ? 'bg-black text-white border-black'
                                                : 'bg-white dark:bg-stone-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-stone-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            {showHistory ? <X className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                                            <span>{showHistory ? "Close" : "History"}</span>
                                        </button>


                                        {/* Context Toggle */}
                                        {classId && (
                                            <button
                                                onClick={() => setUseClassContext(!useClassContext)}
                                                className={`flex items-center gap-2 px-3 py-2 border rounded-lg font-medium text-sm transition-all shadow-sm ${useClassContext
                                                    ? 'bg-[#FF4A1C]/10 text-[#FF4A1C] border-[#FF4A1C]/20'
                                                    : 'bg-white dark:bg-stone-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-stone-700 hover:text-gray-900'
                                                    }`}
                                            >
                                                <Library className="w-4 h-4" />
                                                {useClassContext ? "Searching Class" : "Classwork"}
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleSend}
                                            disabled={!input.trim() || isLoading}
                                            className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium text-sm border border-transparent shadow-sm hover:opacity-80 transition-all"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Thinking...
                                                </>
                                            ) : (
                                                <>
                                                    <span>Send Message</span>
                                                    <ArrowRight className="w-4 h-4" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
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
        </div>
    );
});

export default ChatInterface;
