import React, { useState, useRef, useEffect } from 'react';
import {
    X, Send, RefreshCw, MessageSquare, Loader2, Sparkles,
    ChevronRight, FileText, Minimize2
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

    return <ReactMarkdown className="prose prose-sm max-w-none">{displayedText}</ReactMarkdown>;
};

const ChatDrawer = ({
    isOpen,
    onClose,
    documentId,
    blueprintId,
    contextTitle = "Document Context"
}) => {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: "Hello! I've read your document. Ask me anything about it!"
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingEmbeddings, setIsProcessingEmbeddings] = useState(false);
    const [fetchedDocumentId, setFetchedDocumentId] = useState(null);
    const [isResolvingDocId, setIsResolvingDocId] = useState(false);

    const activeDocumentId = documentId || fetchedDocumentId;

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // DEBUG: Log all props and state
    useEffect(() => {
        console.log('[ChatDrawer] Props/State Update:', {
            isOpen,
            documentId,
            blueprintId,
            fetchedDocumentId,
            activeDocumentId,
            isResolvingDocId,
            contextTitle
        });
    }, [isOpen, documentId, blueprintId, fetchedDocumentId, activeDocumentId, isResolvingDocId, contextTitle]);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 100);
        }
    }, [isOpen]);

    // Fetch document ID if missing
    useEffect(() => {
        const fetchLinkedDocument = async () => {
            if (isOpen && !documentId && blueprintId && !fetchedDocumentId) {
                setIsResolvingDocId(true);
                console.log("[ChatDrawer] Fetching linked document for blueprint:", blueprintId);

                // 1. Get blueprint data including file_metadata
                const { data: bpData, error: bpError } = await supabase
                    .from('blueprints')
                    .select('document_id, file_metadata, class_id')
                    .eq('id', blueprintId)
                    .single();

                if (bpData?.document_id) {
                    console.log("[ChatDrawer] Found document_id in blueprint:", bpData.document_id);
                    setFetchedDocumentId(bpData.document_id);
                    setIsResolvingDocId(false);
                    return;
                }

                // 2. Try to find document via file_metadata in class_documents
                if (bpData?.file_metadata && bpData.class_id) {
                    const fileName = bpData.file_metadata.name;
                    const fileSize = bpData.file_metadata.size;
                    console.log("[ChatDrawer] Searching class_documents by file metadata:", fileName, fileSize);

                    const { data: docData, error: docError } = await supabase
                        .from('class_documents')
                        .select('id')
                        .eq('class_id', bpData.class_id)
                        .eq('name', fileName)
                        .eq('file_size', fileSize)
                        .maybeSingle();

                    if (docData?.id) {
                        console.log("[ChatDrawer] Found document via file_metadata:", docData.id);
                        setFetchedDocumentId(docData.id);
                        setIsResolvingDocId(false);
                        return;
                    }
                }

                // 3. Try document_analyses table (legacy link)
                console.log("[ChatDrawer] Checking document_analyses for legacy link...");
                const { data: daData, error: daError } = await supabase
                    .from('document_analyses')
                    .select('document_id')
                    .eq('blueprint_id', blueprintId)
                    .maybeSingle();

                if (daData?.document_id) {
                    console.log("[ChatDrawer] Found document_id in analyses:", daData.document_id);
                    setFetchedDocumentId(daData.document_id);
                    setIsResolvingDocId(false);
                    return;
                }

                // 4. Check if truly text-only (no file_metadata at all)
                if (!bpData?.file_metadata) {
                    console.log("[ChatDrawer] Blueprint is text-only (no file_metadata)");
                    setMessages(prev => [...prev, {
                        role: 'system',
                        content: 'This blueprint was created from text input only. Chat is not available.'
                    }]);
                } else {
                    console.error("[ChatDrawer] Has file but couldn't find document_id");
                    setMessages(prev => [...prev, {
                        role: 'system',
                        content: 'Could not find document chunks for this file. Try re-analyzing the document.'
                    }]);
                }
                setIsResolvingDocId(false);
            }
        };
        fetchLinkedDocument();
    }, [isOpen, documentId, blueprintId, fetchedDocumentId]);

    // Check and generate embeddings on first open
    useEffect(() => {
        if (isOpen && activeDocumentId) {
            checkAndEmbedDocument();
        }
    }, [isOpen, activeDocumentId]);

    const checkAndEmbedDocument = async () => {
        if (!activeDocumentId) return;

        try {
            // Clean check: see if chunks exist
            const { count, error } = await supabase
                .from('document_chunks')
                .select('*', { count: 'exact', head: true })
                .eq('document_id', activeDocumentId);

            if (count === 0 && !error) {
                console.log("No embeddings found. Generating...");
                setIsProcessingEmbeddings(true);

                const { data, error: fnError } = await supabase.functions.invoke('process-document-embeddings', {
                    body: { document_id: activeDocumentId }
                });

                if (fnError) throw fnError;
                console.log("Embeddings generated:", data);
                setMessages(prev => [...prev, {
                    role: 'system',
                    content: 'I just finished reading your document properly. I am now ready to answer specific questions!'
                }]);
            }
        } catch (err) {
            console.error("Embedding generation failed:", err);
        } finally {
            setIsProcessingEmbeddings(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        if (!activeDocumentId) {
            console.error("Chat Error: No document ID provided (even after fallback).");
            setMessages(prev => [...prev, {
                role: 'system',
                content: 'Error: Context lost (missing document ID). Please try reopening the document.'
            }]);
            return;
        }

        const userMessage = { role: 'user', content: input.trim() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No active session");

            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-document`;

            console.log("Sending chat request:", { documentId: activeDocumentId, messageCount: messages.length + 1 });

            const res = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    document_id: activeDocumentId,
                    messages: [...messages, userMessage],
                    current_message: userMessage.content
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                let errorJson;
                try { errorJson = JSON.parse(errorText); } catch (e) { errorJson = { error: errorText }; }
                console.error("Chat Function Error:", errorJson);
                throw new Error(errorJson.error || `Server error: ${res.status}`);
            }

            const streamReader = res.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessageContent = '';

            // Add placeholder message
            setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

            while (true) {
                const { done, value } = await streamReader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantMessageContent += chunk;

                // Update the last message
                setMessages(prev => {
                    const newMsg = [...prev];
                    const lastIndex = newMsg.length - 1;
                    newMsg[lastIndex] = {
                        role: 'assistant',
                        content: assistantMessageContent,
                        isStreaming: true
                    };
                    return newMsg;
                });
            }

            // Finalize
            setMessages(prev => {
                const newMsg = [...prev];
                const lastIndex = newMsg.length - 1;
                newMsg[lastIndex] = {
                    role: 'assistant',
                    content: assistantMessageContent,
                    isStreaming: false
                };
                return newMsg;
            });

        } catch (err) {
            console.error("Chat error:", err);
            setMessages(prev => [...prev, {
                role: 'system',
                content: `Sorry, I encountered an error: ${err.message}`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Drawer */}
            <div
                className={`fixed inset-y-0 right-0 z-50 w-full md:w-[450px] bg-white dark:bg-stone-900 shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-stone-200 dark:border-stone-800 ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="h-[84px] flex items-center justify-between px-6 border-b border-stone-200 dark:border-stone-800 bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm sticky top-0 z-10">
                    <div>
                        <h3 className="font-semibold text-stone-900 dark:text-stone-100">{contextTitle}</h3>
                    </div>
                </div>

                {/* Info Banner if processing */}
                {isProcessingEmbeddings && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-2 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Reading document and preparing brain...
                    </div>
                )}

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 h-[calc(100vh-8rem)] space-y-6 bg-white dark:bg-stone-900">
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
                                        <div className="markdown-prose dark:prose-invert">
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
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800">
                    <div className="relative flex items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask a question about your document..."
                            disabled={isLoading || isProcessingEmbeddings || isResolvingDocId}
                            className="w-full pl-4 pr-12 py-3.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/20 dark:focus:ring-[#FF4A1C]/20 focus:border-[#FF4A1C] dark:focus:border-[#FF4A1C] transition-all text-sm shadow-inner text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading || isProcessingEmbeddings || isResolvingDocId}
                            className="absolute right-2 p-2 bg-[#FF4A1C] text-white rounded-lg hover:bg-[#e03e15] disabled:opacity-50 disabled:hover:bg-[#FF4A1C] transition-colors shadow-sm"
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
    );
};

export default ChatDrawer;
