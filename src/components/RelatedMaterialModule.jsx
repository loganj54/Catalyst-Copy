import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, ExternalLink, Loader2, FileText, ChevronRight, Search } from 'lucide-react';
import PdfViewerModal from './PdfViewerModal';

const RelatedMaterialModule = ({ query, classId, excludeDocumentId, currentDocumentId, unitColor = "text-[#FF4A1C]" }) => {
    const [matches, setMatches] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Extract key search terms from the original topic query
    const extractSearchText = () => {
        if (!query) return "";
        // Try to get topic name before colon
        const colonIndex = query.indexOf(':');
        if (colonIndex > 0 && colonIndex < 50) {
            return query.substring(0, colonIndex).trim();
        }
        // Otherwise use first 50 chars of query
        return query.substring(0, 50).trim();
    };

    // PDF Viewer State
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewerFile, setViewerFile] = useState(null); // { url, name, initialSearch }

    // On mount, if we have query and classId, we fetch.
    // Optimization: maybe wait until visible? For now, fetch on mount.
    useEffect(() => {
        if (query && classId && !hasSearched) {
            fetchRelatedMaterial();
        }
    }, [query, classId]);

    const fetchRelatedMaterial = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-related-materials`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    query,
                    class_id: classId,
                    exclude_document_id: excludeDocumentId,
                    match_count: 5,
                    // Only show educational content (lectures, textbooks, study guides)
                    // Excludes problem_set and hybrid types which don't provide learning context
                    document_types: ['lecture', 'textbook', 'study_guide']
                })
            });

            const result = await response.json();
            if (result.success) {
                // Filter matches: only show docs where chunk content contains topic keywords
                const topicKeywords = query
                    .toLowerCase()
                    .split(/[\s:,]+/)
                    .filter(w => w.length >= 4)
                    .slice(0, 5); // Take first 5 significant words

                const filteredMatches = (result.matches || []).filter(match => {
                    if (!match.content) return false;
                    const content = match.content.toLowerCase();
                    // Require at least 2 keywords to match
                    const matchCount = topicKeywords.filter(kw => content.includes(kw)).length;
                    return matchCount >= 2;
                });

                // Deduplicate: keep only one instance per document (the first/highest similarity one)
                const seenDocuments = new Set();
                const uniqueMatches = filteredMatches.filter(match => {
                    if (seenDocuments.has(match.document_id)) {
                        return false;
                    }
                    seenDocuments.add(match.document_id);
                    return true;
                });

                console.log(`[RelatedMaterial] Filtered ${result.matches?.length || 0} → ${filteredMatches.length} → ${uniqueMatches.length} unique docs`);
                setMatches(uniqueMatches);
            }
        } catch (error) {
            console.error("Error fetching related material:", error);
        } finally {
            setIsLoading(false);
            setHasSearched(true);
        }
    };

    const handleViewDocument = async (match) => {
        // Get the document record to get the file path
        try {
            const { data: doc, error } = await supabase
                .from('class_documents')
                .select('file_path, name')
                .eq('id', match.document_id)
                .single();

            if (error || !doc) {
                console.error("Could not find document record", error);
                return;
            }

            // The file_path is already a public URL, use it directly
            const fileUrl = doc.file_path;

            if (!fileUrl) {
                console.error("Document has no file_path");
                return;
            }

            const searchText = extractSearchText();
            console.log('[RelatedMaterial] Search text for PDF:', searchText);
            console.log('[RelatedMaterial] Search text for PDF:', searchText);

            setViewerFile({
                url: fileUrl,
                name: doc.name,
                initialSearch: searchText // Use topic name, not chunk content!
            });
            setIsViewerOpen(true);

        } catch (err) {
            console.error("Error opening document:", err);
        }
    };

    if (isLoading) {
        return (
            <div className="py-4 flex items-center gap-2 text-stone-400 text-sm animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching related material...
            </div>
        );
    }

    if (!matches || matches.length === 0) return null;

    return (
        <>
            <div className="mt-2 mb-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                    <BookOpen className={`w-5 h-5 ${unitColor}`} />
                    <h4 className="font-normal tracking-tight text-stone-800 dark:text-stone-200">
                        Find this topic in your document
                    </h4>
                </div>

                <div className="flex flex-col gap-4">
                    {matches.slice(0, 4).map((match, idx) => (
                        <div
                            key={idx}
                            className="group relative bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-4 hover:shadow-md hover:border-[#FF4A1C]/30 transition-all cursor-pointer overflow-hidden"
                            onClick={() => handleViewDocument(match)}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${match.document_id === currentDocumentId ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400"}`}>
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-normal tracking-tight text-sm text-stone-900 dark:text-stone-100 line-clamp-1">
                                            {match.document_name}
                                        </span>
                                        {match.document_id === currentDocumentId && (
                                            <span className="text-[10px] font-medium uppercase tracking-wide text-green-600 dark:text-green-400">
                                                In This Document
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <ExternalLink className="w-3 h-3 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            <div className="relative">
                                <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
                                    Looking for: <span className="font-medium text-orange-600 dark:text-orange-400">"{extractSearchText()}"</span>
                                </p>
                            </div>

                            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[#FF4A1C] opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-200">
                                <Search className="w-3 h-3" />
                                Find in document
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Smart PDF Viewer Modal */}
            <PdfViewerModal
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
                fileUrl={viewerFile?.url}
                fileName={viewerFile?.name}
                initialSearchText={viewerFile?.initialSearch}
            />
        </>
    );
};

export default RelatedMaterialModule;
