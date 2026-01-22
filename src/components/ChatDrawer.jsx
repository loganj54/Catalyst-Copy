import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronRight, FileText, Minimize2, Plus, ArrowLeft, Trash2, Clock, Folder, Library, Send, Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';

// Helper for typewriter effect
const TypewriterText = ({ text, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        let index = 0;
        const timer = setInterval(() => {
            if (index < text.length) {
                setDisplayedText((prev) => prev + text.charAt(index));
                index++;
            } else {
                clearInterval(timer);
                onComplete && onComplete();
            }
        }, 5); // Fast typewriter
        return () => clearInterval(timer);
    }, [text, onComplete]);

    return <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert break-words">{displayedText}</ReactMarkdown>;
};

const ChatDrawer = ({
    isOpen,
    onClose,
    documentId,
    blueprintId,
    contextTitle = "Document Context",
    hasDocument = true
}) => {
    // View state: 'chat' or 'list'
    const [view, setView] = useState('chat');

    // Thread state
    const [threads, setThreads] = useState([]);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [isLoadingThreads, setIsLoadingThreads] = useState(false);

    // Chat state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingEmbeddings, setIsProcessingEmbeddings] = useState(false);
    const [fetchedDocumentId, setFetchedDocumentId] = useState(null);
    const [isResolvingDocId, setIsResolvingDocId] = useState(false);
    const [classId, setClassId] = useState(null);
    const [useClassContext, setUseClassContext] = useState(false);

    const activeDocumentId = documentId || fetchedDocumentId;

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Initial load: resolve doc ID and fetch threads
    useEffect(() => {
        if (isOpen && blueprintId) {
            resolveDocumentId();
            fetchThreads();
        }
    }, [isOpen, blueprintId]);

    // When thread changes, load messages
    useEffect(() => {
        if (activeThreadId) {
            fetchMessages(activeThreadId);
        } else if (isOpen) {
            // If no thread active, ensure we have a clean slate (or create new temporary)
            // But actually, we want to allow user to start typing to create a thread?
            // Or explicitly create one.
            // For now, let's just clear messages if no thread
            setMessages([{
                role: 'assistant',
                content: hasDocument
                    ? "Hello! I've read your document. Ask me anything about it!"
                    : "Hello! I'm here to help. Ask me anything!"
            }]);
        }
    }, [activeThreadId, isOpen]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading, input]);


    // --- DATA FETCHING ---

    const resolveDocumentId = async () => {
        if (documentId || fetchedDocumentId) return;

        setIsResolvingDocId(true);
        try {
            // 1. Get blueprint data
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

            // 2. Try file_metadata match
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

            // 3. Document Analyses
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

            // If no active thread and threads exist, maybe select the most recent?
            // Or keep it null to prompt new? User logic: "Save it... I can go back to it"
            // Let's default to the most recent thread if available and we haven't selected one
            if (data?.length > 0 && !activeThreadId) {
                setActiveThreadId(data[0].id);
            }
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
                    content: "Hello! This is a new thread. Ask me anything!"
                }]);
            }
        } catch (error) {
            console.error("Error fetching messages:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const createNewThread = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('chat_threads')
                .insert({
                    blueprint_id: blueprintId,
                    user_id: user.id,
                    title: 'New Conversation'
                })
                .select()
                .single();

            if (error) throw error;

            setThreads([data, ...threads]);
            setActiveThreadId(data.id);
            setView('chat'); // Ensure we are in chat view
            setMessages([{
                role: 'assistant',
                content: hasDocument
                    ? "Hello! I've read your document. Ask me anything about it!"
                    : "Hello! I'm here to help. Ask me anything!"
            }]);
        } catch (error) {
            console.error("Error creating thread:", error);
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
                setMessages([{
                    role: 'assistant',
                    content: hasDocument
                        ? "Hello! I've read your document. Ask me anything about it!"
                        : "Hello! I'm here to help. Ask me anything!"
                }]);
            }
        } catch (error) {
            console.error("Error deleting thread:", error);
        }
    };

    // --- MESSAGING ---

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        // Ensure we have a thread
        let currentThreadId = activeThreadId;
        if (!currentThreadId) {
            // Create a thread on the fly!
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const { data, error } = await supabase
                    .from('chat_threads')
                    .insert({
                        blueprint_id: blueprintId,
                        user_id: user.id,
                        title: input.trim().substring(0, 30) + '...' // Simple auto-title
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

        // Optimistic update
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
        setIsLoading(true);

        try {
            // 1. Save User Message
            await supabase.from('chat_messages').insert({
                thread_id: currentThreadId,
                role: 'user',
                content: userMessageContent
            });

            // 2. Call Edge Function
            const { data: { session } } = await supabase.auth.getSession();
            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-document`;

            // Build history from current messages (excluding the one we just added optimistically to avoid dupes if logic weirdness, but actually we need to send it)
            // Best to send the full history including the new one.
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

            // Placeholder for streaming
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

            // 3. Save Assistant Message
            await supabase.from('chat_messages').insert({
                thread_id: currentThreadId,
                role: 'assistant',
                content: assistantMessageContent
            });

            // Finalize state
            setMessages(prev => {
                const newMsg = [...prev];
                newMsg[newMsg.length - 1] = {
                    role: 'assistant',
                    content: assistantMessageContent,
                    isStreaming: false
                };
                return newMsg;
            });

            // Update thread timestamp
            await supabase.from('chat_threads')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', currentThreadId);

            fetchThreads(); // Refresh list order to show latest on top

            // Auto-title if this is the first real message (or title is default)
            // We can check if thread title is "New Conversation" locally or just fire and forget
            const currentThread = threads.find(t => t.id === currentThreadId) || { title: 'New Conversation' };
            if (currentThread.title === 'New Conversation' || currentThread.title === '') {
                // Fire and forget title generation
                supabase.functions.invoke('generate-chat-title', {
                    body: {
                        message: userMessageContent,
                        thread_id: currentThreadId
                    }
                }).then(({ data, error }) => {
                    if (!error && data?.title) {
                        // Update local state
                        setThreads(prev => prev.map(t =>
                            t.id === currentThreadId ? { ...t, title: data.title } : t
                        ));
                    }
                });
            }

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

    // --- UI HELPERS ---

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


    return (
        <div
            className={`fixed inset-y-0 right-0 z-[100] w-full md:w-[450px] bg-white dark:bg-stone-900 shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-stone-200 dark:border-stone-800 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
            {/* Header */}
            <div className="h-[88px] flex items-center justify-between px-4 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 sticky top-0 z-10 transition-all">
                <h3 className="font-normal tracking-tight text-stone-900 dark:text-stone-100 truncate flex-1 mr-4">
                    {view === 'list' ? 'Conversations' : (threads.find(t => t.id === activeThreadId)?.title || contextTitle)}
                </h3>

                <div className="flex items-center gap-2">
                    {view === 'chat' && (
                        <button
                            onClick={() => setView('list')}
                            className="p-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 transition-all shadow-sm"
                            title="View History"
                        >
                            <Folder className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={createNewThread}
                        className="p-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400 transition-all shadow-sm"
                        title="New Chat"
                    >
                        <Plus className="w-4 h-4" />
                    </button>

                    {classId && (
                        <button
                            onClick={() => setUseClassContext(!useClassContext)}
                            className={`p-2 border rounded-lg transition-all shadow-sm ${useClassContext
                                ? 'bg-[#FF4A1C]/10 border-[#FF4A1C] text-[#FF4A1C]'
                                : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400 hover:text-stone-600'
                                }`}
                            title={useClassContext ? "Searching all class documents" : "Search specific document only"}
                        >
                            <Library className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 relative flex flex-col bg-white dark:bg-stone-900">

                {/* List View */}
                {view === 'list' ? (
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {threads.length === 0 ? (
                            <div className="text-center py-10 text-stone-500">
                                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No conversations yet.</p>
                                <button onClick={createNewThread} className="mt-4 text-[#FF4A1C] hover:underline font-medium">Start a new chat</button>
                            </div>
                        ) : (
                            threads.map(thread => (
                                <div
                                    key={thread.id}
                                    onClick={() => { setActiveThreadId(thread.id); setView('chat'); }}
                                    className={`group p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${activeThreadId === thread.id
                                        ? 'bg-[#FF4A1C]/5 border-[#FF4A1C]/30'
                                        : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-[#FF4A1C]/30'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-medium text-stone-900 dark:text-stone-100 line-clamp-1">{thread.title || 'New Conversation'}</h4>
                                        <button
                                            onClick={(e) => deleteThread(e, thread.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 transition-opacity"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(thread.updated_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    /* Chat View */
                    <>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-stone-900">
                            {messages.map((msg, idx) => {
                                const isUser = msg.role === 'user';
                                const isSystem = msg.role === 'system';

                                if (isSystem) {
                                    return (
                                        <div key={idx} className="flex justify-center">
                                            <span className="text-xs bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 px-3 py-1 rounded-full">
                                                {msg.content}
                                            </span>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={`max-w-[85%] rounded-lg px-5 py-3 text-sm leading-relaxed shadow-sm ${isUser
                                                ? 'bg-[#FF4A1C]/5 dark:bg-[#FF4A1C]/10 text-stone-900 dark:text-stone-100 border border-[#FF4A1C]'
                                                : 'bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 text-stone-700 dark:text-stone-300 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                                }`}
                                        >
                                            {isUser ? (
                                                msg.content
                                            ) : (
                                                <div className="prose prose-sm max-w-none dark:prose-invert break-words">
                                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {isLoading && !messages[messages.length - 1]?.isStreaming && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-lg px-5 py-3 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                                        <span className="text-xs text-stone-400">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="px-4 py-4 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800">
                            <div className="p-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#FF4A1C]/20 focus-within:border-[#FF4A1C]">
                                <div className="relative flex items-end">
                                    <textarea
                                        ref={inputRef}
                                        value={input}
                                        onChange={handleInput}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Ask a question..."
                                        disabled={isLoading}
                                        rows={1}
                                        className="w-full pl-4 pr-12 py-3 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 max-h-[200px] overflow-y-auto"
                                        style={{ minHeight: '44px' }}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isLoading}
                                        className="absolute right-2 bottom-1.5 p-2 bg-[#FF4A1C] text-white rounded-lg hover:bg-[#e03e15] disabled:opacity-50 disabled:hover:bg-[#FF4A1C] transition-colors shadow-sm"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatDrawer;
