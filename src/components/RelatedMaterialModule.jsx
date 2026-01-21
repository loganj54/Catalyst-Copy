import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, ExternalLink, Loader2, FileText, ChevronRight, Search } from 'lucide-react';
import PdfViewerModal from './PdfViewerModal';

const RelatedMaterialModule = ({ query, classId, excludeDocumentId, currentDocumentId, unitColor = "text-[#FF4A1C]", showSectionHeader = false }) => {
    const [matches, setMatches] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    // ... existing code ...
    if (!matches || matches.length === 0) return null;

    const content = (
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
    );

    return (
        <>
            {showSectionHeader ? (
                <div className="pt-4 border-t border-stone-300 dark:border-stone-600">
                    <p className="text-sm font-medium uppercase tracking-wider text-stone-600 dark:text-stone-300 mb-2">
                        Related
                    </p>
                    {content}
                </div>
            ) : content}

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
