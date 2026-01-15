import React, { useState, useEffect, useRef } from 'react';
import { X, Search, ChevronUp, ChevronDown, Loader2, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker - use jsdelivr with exact version from react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Custom text search implementation for react-pdf
const highlightPattern = (text, pattern) => {
    if (!pattern) return text;
    // Simple exact match logic for now
    return text.toString().replace(new RegExp(pattern, 'gi'), (value) => `<mark>${value}</mark>`);
};


const PdfViewerModal = ({ isOpen, onClose, fileUrl, fileName, initialSearchText }) => {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.2);
    const [searchText, setSearchText] = useState(initialSearchText || '');
    const [searchMatches, setSearchMatches] = useState([]); // [{ pageIndex, matchIndex }]
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pdfDocument, setPdfDocument] = useState(null);
    const [searchCompleted, setSearchCompleted] = useState(false); // Track if search finished

    // Reset state when opening new file
    useEffect(() => {
        if (isOpen && fileUrl) {
            setPageNumber(1);
            setSearchMatches([]);
            setCurrentMatchIndex(0);
            setSearchText(initialSearchText || '');
            setError(null);
            setIsLoading(true);
            setSearchCompleted(false);
        }
    }, [isOpen, fileUrl, initialSearchText]);

    const onDocumentLoadSuccess = async (pdf) => {
        setNumPages(pdf.numPages);
        setPdfDocument(pdf);
        setIsLoading(false);

        // Auto-search if text provided
        if (initialSearchText) {
            await performSearch(pdf, initialSearchText);
        }
    };

    const onDocumentLoadError = (err) => {
        console.error("Error loading PDF:", err);
        setError("Failed to load document.");
        setIsLoading(false);
    };

    // Perform text search across all pages
    // Uses multiple strategies for better matching
    const performSearch = async (pdf, text) => {
        if (!text || !pdf) return;

        const matches = [];
        const normalize = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim();

        // Sanitize text: remove JSON-like patterns, quotes, special characters, etc.
        const sanitizeText = (str) => {
            return str
                // Remove JSON-like patterns
                .replace(/\{[^}]+\}/g, ' ')
                .replace(/\[[^\]]+\]/g, ' ')
                .replace(/"[^"]+"\s*:/g, ' ')
                // Remove all quote characters
                .replace(/["'"]/g, '')
                // Remove common JSON keys
                .replace(/difficulty|section_id|key_concepts|unit_id|topic/gi, ' ')
                // Remove numbers that look like IDs
                .replace(/\b\d{5,}\b/g, ' ')
                // Normalize whitespace
                .replace(/\s+/g, ' ')
                .trim();
        };

        // Extract individual topics from comma-separated content
        const extractTopics = (str) => {
            // If content looks like comma-separated topics, split them
            const items = str.split(/,\s*/).filter(item => item.length > 10);
            return items.length > 1 ? items : [str];
        };

        const cleanText = sanitizeText(text);
        const topics = extractTopics(cleanText);
        console.log('[PdfViewer] Clean topics:', topics.slice(0, 3));

        // Strategy: Extract search terms from each topic
        const extractSearchTerms = (topicList) => {
            const terms = [];

            for (const topic of topicList) {
                const normalized = normalize(topic);

                // Add the whole topic if short enough
                if (normalized.length >= 15 && normalized.length <= 80) {
                    terms.push(normalized);
                }

                // Add first 40 chars of longer topics
                if (normalized.length > 40) {
                    terms.push(normalized.slice(0, 40));
                }

                // Extract 3-word phrases from each topic
                const words = topic.split(/\s+/).filter(w => w.length > 3 && !/^\d+$/.test(w));
                if (words.length >= 3) {
                    const phrase = words.slice(0, 3).join(' ').toLowerCase();
                    if (phrase.length >= 12) {
                        terms.push(normalize(phrase));
                    }
                }
            }

            return [...new Set(terms)].filter(t => t.length >= 10); // Dedupe and filter
        };

        const searchTerms = extractSearchTerms(topics);
        console.log('[PdfViewer] Search terms:', searchTerms.slice(0, 8));

        try {
            setIsLoading(true);

            // Cache page texts to avoid re-fetching
            const pageTexts = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                pageTexts.push({ pageIndex: i, text: normalize(pageText) });
            }

            // Search with each term
            for (const term of searchTerms) {
                for (const { pageIndex, text: normalizedPageText } of pageTexts) {
                    if (normalizedPageText.includes(term)) {
                        // Avoid duplicates
                        if (!matches.find(m => m.pageIndex === pageIndex)) {
                            matches.push({
                                pageIndex,
                                matchedTerm: term.slice(0, 40) + '...',
                                confidence: 'high'
                            });
                        }
                    }
                }
                if (matches.length >= 3) break; // Found enough
            }

            // FALLBACK 1: Two-word phrase search
            if (matches.length === 0) {
                console.log('[PdfViewer] Trying 2-word phrase search...');

                // Extract 2-word phrases from the topic
                const words = cleanText.split(/\s+/).filter(w => w.length >= 3 && !/^\d+$/.test(w));
                const twoWordPhrases = [];
                for (let i = 0; i < words.length - 1; i++) {
                    const phrase = (words[i] + ' ' + words[i + 1]).toLowerCase();
                    if (phrase.length >= 8) {
                        twoWordPhrases.push(phrase);
                    }
                }

                console.log('[PdfViewer] 2-word phrases:', twoWordPhrases.slice(0, 5));

                for (const phrase of twoWordPhrases) {
                    for (const { pageIndex, text } of pageTexts) {
                        if (text.includes(phrase) && !matches.find(m => m.pageIndex === pageIndex)) {
                            matches.push({
                                pageIndex,
                                matchedTerm: phrase,
                                confidence: '2-word-match'
                            });
                        }
                    }
                    if (matches.length >= 3) break;
                }

                if (matches.length > 0) {
                    console.log('[PdfViewer] 2-word search found pages:', matches);
                }
            }

            // FALLBACK 2: Word-by-word search (lowered threshold to 2)
            if (matches.length === 0) {
                console.log('[PdfViewer] Trying word-by-word search...');

                // Get significant words from the chunk (4+ chars, not common words)
                const stopWords = new Set(['about', 'after', 'being', 'between', 'could', 'during', 'every', 'first', 'found', 'great', 'having', 'however', 'other', 'should', 'since', 'still', 'their', 'there', 'these', 'thing', 'think', 'those', 'through', 'under', 'using', 'where', 'which', 'while', 'would', 'with', 'from', 'this', 'that', 'have', 'will', 'been', 'when', 'what', 'into', 'only', 'also', 'more', 'some', 'than', 'then', 'very', 'just', 'over', 'such', 'make', 'like', 'time', 'know', 'take', 'come', 'made', 'find', 'give', 'most', 'even', 'well', 'back', 'much', 'good', 'want', 'long', 'work', 'need', 'feel', 'seem', 'call', 'keep', 'last', 'same', 'turn', 'part', 'each', 'both', 'many', 'must', 'down', 'look', 'area']);
                const significantWords = cleanText
                    .split(/\s+/)
                    .filter(w => w.length >= 4 && !stopWords.has(w.toLowerCase()) && !/^\d+$/.test(w))
                    .map(w => w.toLowerCase());

                console.log('[PdfViewer] Significant words:', significantWords);

                // Count word occurrences per page
                const pageWordCounts = pageTexts.map(({ pageIndex, text }) => {
                    let count = 0;
                    const matchedWords = [];
                    for (const word of significantWords) {
                        if (text.includes(word)) {
                            count++;
                            matchedWords.push(word);
                        }
                    }
                    return { pageIndex, count, matchedWords };
                });

                // Sort by word count and take best matches (lowered threshold to 2)
                pageWordCounts.sort((a, b) => b.count - a.count);
                const bestPages = pageWordCounts.filter(p => p.count >= 2).slice(0, 3);

                for (const { pageIndex, count, matchedWords } of bestPages) {
                    matches.push({
                        pageIndex,
                        matchedTerm: `${count} words: ${matchedWords.slice(0, 3).join(', ')}`,
                        confidence: 'word-match'
                    });
                }

                if (bestPages.length > 0) {
                    console.log(`[PdfViewer] Word search found pages:`, bestPages);
                }
            }

            // FALLBACK 3: Single keyword search (just find any page with any key word)
            if (matches.length === 0) {
                console.log('[PdfViewer] Trying single keyword search...');

                const keywords = cleanText
                    .split(/\s+/)
                    .filter(w => w.length >= 5 && !/^\d+$/.test(w))
                    .map(w => w.toLowerCase());

                for (const keyword of keywords) {
                    for (const { pageIndex, text } of pageTexts) {
                        if (text.includes(keyword) && !matches.find(m => m.pageIndex === pageIndex)) {
                            matches.push({
                                pageIndex,
                                matchedTerm: keyword,
                                confidence: 'single-word'
                            });
                            break; // One match per keyword
                        }
                    }
                    if (matches.length >= 2) break;
                }

                if (matches.length > 0) {
                    console.log('[PdfViewer] Single keyword found pages:', matches);
                }
            }

            setSearchMatches(matches);
            setSearchCompleted(true); // Mark search as complete
            if (matches.length > 0) {
                console.log(`[PdfViewer] Found ${matches.length} matches, jumping to page ${matches[0].pageIndex}`);
                setPageNumber(matches[0].pageIndex);
                setCurrentMatchIndex(0);
            } else {
                console.log('[PdfViewer] No matches found in document');
            }
        } catch (e) {
            console.error("Search error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const nextMatch = () => {
        if (searchMatches.length === 0) return;
        const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
        setCurrentMatchIndex(nextIndex);
        setPageNumber(searchMatches[nextIndex].pageIndex);
    };

    const prevMatch = () => {
        if (searchMatches.length === 0) return;
        const nextIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
        setCurrentMatchIndex(nextIndex);
        setPageNumber(searchMatches[nextIndex].pageIndex);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-stone-900 w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-scale-in">

                {/* Header */}
                <div className="relative flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 z-10 h-20">
                    <div className="flex flex-col gap-1 z-10 max-w-[45%]">
                        <h3 className="font-semibold text-lg text-stone-900 dark:text-stone-100 truncate">
                            {fileName || "Document Viewer"}
                        </h3>
                        {initialSearchText && (
                            <span className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1 truncate">
                                <Search className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                    Looking for: <span className="font-medium text-orange-600 dark:text-orange-400">"{initialSearchText}"</span>
                                </span>
                            </span>
                        )}
                    </div>

                    {/* Absolutely Centered Match Controls */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
                        {/* Search Controls */}
                        {searchMatches.length > 0 ? (
                            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-700/50 shadow-sm">
                                <span className="text-xs font-medium text-orange-700 dark:text-orange-400 whitespace-nowrap">
                                    Match {currentMatchIndex + 1} of {searchMatches.length}
                                </span>
                                <div className="flex gap-1 border-l border-orange-200 dark:border-orange-700/50 pl-2 ml-1">
                                    <button onClick={prevMatch} className="p-0.5 hover:bg-orange-100 dark:hover:bg-orange-800 rounded text-orange-600 dark:text-orange-400">
                                        <ChevronUp className="w-4 h-4" />
                                    </button>
                                    <button onClick={nextMatch} className="p-0.5 hover:bg-orange-100 dark:hover:bg-orange-800 rounded text-orange-600 dark:text-orange-400">
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : searchText && !isLoading && searchCompleted && (
                            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-700/50">
                                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                    No specific section found
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Zoom Controls */}
                        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 rounded-lg p-1">
                            <button onClick={() => setScale(s => Math.max(0.6, s - 0.2))} className="p-1.5 hover:bg-white dark:hover:bg-stone-700 rounded-md transition-colors">
                                <ZoomOut className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                            </button>
                            <span className="text-xs font-medium w-12 text-center text-stone-600 dark:text-stone-400">
                                {Math.round(scale * 100)}%
                            </span>
                            <button onClick={() => setScale(s => Math.min(3.0, s + 0.2))} className="p-1.5 hover:bg-white dark:hover:bg-stone-700 rounded-md transition-colors">
                                <ZoomIn className="w-4 h-4 text-stone-600 dark:text-stone-400" />
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full text-stone-500 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Viewer Body */}
                <div className="flex-1 bg-stone-100 dark:bg-stone-950 overflow-auto flex justify-center p-8 relative">
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                            <Loader2 className="w-10 h-10 animate-spin text-[#FF4A1C]" />
                            <p className="mt-4 font-medium text-stone-600 dark:text-stone-300">
                                {pdfDocument ? "Searching document..." : "Loading PDF..."}
                            </p>
                        </div>
                    )}

                    {error ? (
                        <div className="flex flex-col items-center justify-center text-stone-500">
                            <AlertCircle className="w-12 h-12 mb-4 text-red-400" />
                            <p>{error}</p>
                        </div>
                    ) : (
                        <Document
                            file={fileUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={null}
                            className="shadow-xl"
                        >
                            <Page
                                pageNumber={pageNumber}
                                scale={scale}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                className="bg-white shadow-lg"
                                customTextRenderer={({ str, itemIndex }) => {
                                    // Basic highlighting visual
                                    // Note: react-pdf has complex text layer rendering, simplistic replace might break layout.
                                    // Better to assume the jump-to-page is sufficient 'Context' helper.
                                    // But we can try marking it if simple.
                                    return str;
                                }}
                            />
                        </Document>
                    )}
                </div>

                {/* Footer / Pagination */}
                {numPages && (
                    <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex justify-center items-center gap-4">
                        <button
                            disabled={pageNumber <= 1}
                            onClick={() => setPageNumber(p => p - 1)}
                            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg disabled:opacity-50"
                        >
                            <ChevronUp className="w-4 h-4 rotate-[-90deg]" />
                        </button>
                        <span className="text-sm font-medium text-stone-600 dark:text-stone-300">
                            Page {pageNumber} of {numPages}
                        </span>
                        <button
                            disabled={pageNumber >= numPages}
                            onClick={() => setPageNumber(p => p + 1)}
                            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg disabled:opacity-50"
                        >
                            <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PdfViewerModal;
