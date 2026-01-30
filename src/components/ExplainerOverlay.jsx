import React, { useEffect, useState, useRef } from 'react';
import { useUiState } from '../context/UiStateContext';
import { X, Sparkles, Play, RefreshCw, Star, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

/**
 * ExplainerBubble Component
 * Handles the logic for a SINGLE explainer bubble + its connection line
 */
const ExplainerBubble = ({ explainer, onClose, index, onLayoutUpdate, layoutOffset = 0, obstacles = [], horizontalJitter = 0, verticalLaneOffset = 0 }) => {
    const [linePath, setLinePath] = useState('');
    const [bubblePosition, setBubblePosition] = useState({ top: 0, left: 0 });
    const [isVisible, setIsVisible] = useState(false);

    // Video specific state
    const [rating, setRating] = useState(4);
    const [isRerolling, setIsRerolling] = useState(false);
    const [videos, setVideos] = useState([]);
    const [rankedVideos, setRankedVideos] = useState([]);  // Full ranked list for reroll
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [isLoadingVideos, setIsLoadingVideos] = useState(false);
    const [hasFetchedVideos, setHasFetchedVideos] = useState(false);
    const [selectedVideoType, setSelectedVideoType] = useState(null);
    const [showVideoTypeSelector, setShowVideoTypeSelector] = useState(explainer.type === 'video');
    const [debugInfo, setDebugInfo] = useState(null);

    // AI Query Generation state
    const [generatedQueries, setGeneratedQueries] = useState([]);
    const [isGeneratingQueries, setIsGeneratingQueries] = useState(false);
    const [selectedQuery, setSelectedQuery] = useState(null);


    // Explanation specific state
    const [explanation, setExplanation] = useState(null);
    const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true); // Default to expanded

    // Question chat state
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
    const messagesEndRef = useRef(null);

    const handleReroll = (e) => {
        e.stopPropagation();
        if (rankedVideos.length <= 1) return;

        setIsRerolling(true);
        const nextIndex = (currentVideoIndex + 1) % rankedVideos.length;
        setCurrentVideoIndex(nextIndex);
        setVideos([rankedVideos[nextIndex]]);
        setTimeout(() => setIsRerolling(false), 500);
    };

    // Helper: Format Duration
    const formatDuration = (seconds) => {
        if (!seconds) return null;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Helper: Get YouTube Thumbnail
    const getThumbnail = (video) => {
        if (video.thumbnail_url) return video.thumbnail_url;
        // Fallback for YouTube
        const match = video.url?.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
        return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
    };

    const currentVideo = videos.length > 0 ? videos[currentVideoIndex] : null;

    // Auto-scroll chat to bottom when new messages arrive
    useEffect(() => {
        if (explainer.type === 'question' && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, explainer.type]);

    // Handle sending a question
    const handleSendQuestion = async () => {
        if (!chatInput.trim() || isLoadingAnswer) return;

        const userMessage = chatInput.trim();
        setChatInput('');

        // Add user message to chat
        const newUserMessage = { role: 'user', content: userMessage };
        setChatMessages(prev => [...prev, newUserMessage]);

        setIsLoadingAnswer(true);

        try {
            const { data, error } = await supabase.functions.invoke('ask-question', {
                body: {
                    term: explainer.term,
                    context: explainer.context || 'general engineering',
                    solutionContext: explainer.solutionContext || null,
                    question: userMessage,
                    conversationHistory: chatMessages
                }
            });

            if (error) throw error;

            // Add AI response to chat
            const aiMessage = { role: 'assistant', content: data.answer };
            setChatMessages(prev => [...prev, aiMessage]);
        } catch (err) {
            console.error('Failed to get answer:', err);
            const errorMessage = { role: 'assistant', content: 'Sorry, I could not generate an answer at this time. Please try again.' };
            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoadingAnswer(false);
        }
    };

    // Handle Enter key to send
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendQuestion();
        }
    };

    // Ref to the local container for this specific bubble's line SVG
    const bubbleRef = useRef(null);
    const containerRef = useRef(null);
    const fixedOffsetRef = useRef(null);

    // Config
    const BUBBLE_WIDTH = 500;
    const RIGHT_MARGIN = 40;

    // Reset fetch state when explainer changes
    useEffect(() => {
        setHasFetchedVideos(false);
        setVideos([]);
        setRankedVideos([]);
        setGeneratedQueries([]);
        setSelectedQuery(null);
    }, [explainer.term, explainer.context]);

    // Generate AI queries when video overlay opens
    useEffect(() => {
        const generateQueries = async () => {
            // Only generate for video type when we don't already have queries
            if (explainer.type !== 'video' || generatedQueries.length > 0 || isGeneratingQueries) {
                return;
            }

            setIsGeneratingQueries(true);

            try {
                console.log(`[ExplainerBubble] Generating AI queries for term: "${explainer.term}"`);

                const { data, error } = await supabase.functions.invoke('generate-video-queries', {
                    body: {
                        term: explainer.term,
                        context: explainer.context || '',
                        solutionContext: explainer.solutionContext || ''
                    }
                });

                if (error) throw error;

                if (data && data.success && data.queries && data.queries.length > 0) {
                    console.log(`[ExplainerBubble] Generated ${data.queries.length} queries:`, data.queries);
                    setGeneratedQueries(data.queries);
                } else {
                    console.log('[ExplainerBubble] No queries generated, falling back to defaults');
                    // Fall back to showing the old UI
                }
            } catch (err) {
                console.error('[ExplainerBubble] Failed to generate queries:', err);
                // Fall back to showing the old UI (generatedQueries stays empty)
            } finally {
                setIsGeneratingQueries(false);
            }
        };

        generateQueries();
    }, [explainer.type, explainer.term, explainer.context, explainer.solutionContext]);

    // Fetch Video Effect - Only fetch after query is selected
    const fetchVideos = async () => {
        if (!selectedQuery) return;

        setIsLoadingVideos(true);
        setShowVideoTypeSelector(false);

        try {
            // Get term and context for the sandbox function
            const term = explainer.term;
            const unitTopic = explainer.context || '';
            const problemText = explainer.problemContext || '';

            console.log(`[ExplainerBubble] Calling 'find-videos-sandbox' for term: "${term}", query: "${selectedQuery}"`);

            const { data, error } = await supabase.functions.invoke('find-videos-sandbox', {
                body: {
                    term: term,
                    selected_query: selectedQuery,
                    unit_topic: unitTopic,
                    problem_text: problemText,
                    blueprint_id: explainer.blueprintId || null
                }
            });

            if (error) throw error;

            // Handle the new response format with ranked videos
            if (data && data.success && data.video) {
                // Set the current video
                setVideos([{
                    url: data.video.url,
                    title: data.video.title,
                    channelName: data.video.channel_name,
                    thumbnailUrl: data.video.thumbnail_url,
                    duration: data.video.duration_seconds,
                    summary: data.video.summary,
                    scores: data.video.scores
                }]);

                // Store full ranked list for reroll
                if (data.ranked_videos && data.ranked_videos.length > 0) {
                    setRankedVideos(data.ranked_videos.map(v => ({
                        url: v.url,
                        title: v.title,
                        channelName: v.channel_name,
                        thumbnailUrl: v.thumbnail_url,
                        duration: v.duration_seconds,
                        summary: v.summary,
                        rank: v.rank
                    })));
                    setCurrentVideoIndex(0);
                }

                // Store debug information
                if (data.debug) {
                    setDebugInfo(data.debug);
                }

                console.log(`[ExplainerBubble] Found video: "${data.video.title}" (source: ${data.source})`);
                if (data.stats) {
                    console.log(`[ExplainerBubble] Stats: searched ${data.stats.videos_searched}, analyzed ${data.stats.videos_analyzed}`);
                }
            } else {
                console.log('[ExplainerBubble] No videos found.');
            }
        } catch (err) {
            console.error('Failed to search videos:', err);
        } finally {
            setIsLoadingVideos(false);
            setHasFetchedVideos(true);
        }
    };


    // Fetch Explanation Effect
    useEffect(() => {
        if (explainer.type === 'explain' && !explanation && !isLoadingExplanation) {
            const fetchExplanation = async () => {
                setIsLoadingExplanation(true);
                try {
                    const { data, error } = await supabase.functions.invoke('explain-term', {
                        body: {
                            term: explainer.term,
                            context: explainer.context || 'general engineering',
                            solutionContext: explainer.solutionContext || null
                        }
                    });

                    if (error) throw error;
                    setExplanation(data.explanation);
                } catch (err) {
                    console.error('Failed to fetch explanation:', err);
                    setExplanation('Sorry, we could not generate an explanation at this time.');
                } finally {
                    setIsLoadingExplanation(false);
                }
            };
            fetchExplanation();
        }
    }, [explainer.type, explainer.term, explainer.context]);


    useEffect(() => {
        // If not open, hide and return
        if (!explainer.isOpen) {
            setIsVisible(false);
            return;
        }

        const updatePosition = () => {
            // Find the main container
            const textColumn = document.getElementById('blueprint-content-column');
            const parentElement = document.getElementById('blueprint-content-column')?.parentElement;

            if (!parentElement) return;
            if (!containerRef.current || !containerRef.current.parentElement) return;

            const parentRect = containerRef.current.parentElement.getBoundingClientRect();

            let startX, startY;

            // 1. Resolve Anchor Coordinates
            let liveElement = null;
            if (explainer.anchorId) {
                liveElement = document.getElementById(explainer.anchorId);
            }

            if (liveElement && liveElement.isConnected) {
                const rect = liveElement.getBoundingClientRect();
                startX = rect.left - parentRect.left + (rect.width / 2);
                startY = rect.bottom - parentRect.top - 2;
            } else if (explainer.anchorRect) {
                if (explainer.anchorRect.docTop && explainer.anchorRect.docLeft) {
                    const parentDocTop = parentRect.top + window.scrollY;
                    const parentDocLeft = parentRect.left + window.scrollX;

                    startX = explainer.anchorRect.docLeft - parentDocLeft + (explainer.anchorRect.width / 2);
                    startY = explainer.anchorRect.docBottom ? (explainer.anchorRect.docBottom - parentDocTop - 2) : (explainer.anchorRect.docTop + explainer.anchorRect.height - parentDocTop - 2);
                } else {
                    startX = explainer.anchorRect.left - parentRect.left + (explainer.anchorRect.width / 2);
                    startY = explainer.anchorRect.bottom - parentRect.top - 2;
                }
            } else {
                return;
            }

            // REPORT START Y to parent for lane collision handling
            if (onLayoutUpdate) {
                // We need to measure bubble height for layout metrics too
                let currentBubbleHeight = 150;
                if (bubbleRef.current) {
                    currentBubbleHeight = bubbleRef.current.offsetHeight;
                }

                // FIX: Include verticalLaneOffset in the reported IdealY so parent sorts correctly based on visual position
                const baseDropHeight = 4;
                const DROP_HEIGHT = baseDropHeight + verticalLaneOffset;
                const horizontalY = startY + DROP_HEIGHT;
                const idealBubbleTop = (horizontalY - (currentBubbleHeight / 2));

                onLayoutUpdate(explainer.id, {
                    idealY: idealBubbleTop,
                    height: currentBubbleHeight,
                    startY: startY, // Report StartY for lane detection
                    startX: startX
                });
            }

            // Bubble Configuration
            // 1. Calculate the line level
            // Apply verticalLaneOffset: cascading effect for overlapping lines
            const baseDropHeight = 4;
            const DROP_HEIGHT = baseDropHeight + verticalLaneOffset;

            const CORNER_RADIUS = 10;
            const horizontalY = startY + DROP_HEIGHT; // The Y level where the line travels horizontally

            // Initial bubble height estimate is 150, but we have strict measurement value.
            let currentBubbleHeight = 150;
            if (bubbleRef.current) {
                currentBubbleHeight = bubbleRef.current.offsetHeight;
            }

            // Calculate "Ideal" Top to center the bubble on horizontalY
            // With Layout Offset logic, we apply the parent's calculated shift
            // NOTE: If we offset the line (horizontalY) by laneOffset, we should PROBABLY shift the bubble ideal top too?
            // Yes, user wants the line to go UNDER/OVER. Cascading effect.
            // So centering on the NEW horizontalY maintains the straightness.
            const idealBubbleTop = (horizontalY - (currentBubbleHeight / 2));
            const bubbleTop = idealBubbleTop + layoutOffset;
            const endY = bubbleTop + (currentBubbleHeight / 2);

            // --- POSITIONING LOGIC ---
            let bubbleLeftPos = 0;

            if (textColumn) {
                const colRect = textColumn.getBoundingClientRect();
                const windowRight = document.documentElement.clientWidth;
                const availableSpace = windowRight - colRect.right;

                if (fixedOffsetRef.current === null) {
                    let gap = (availableSpace - BUBBLE_WIDTH) / 2;
                    if (gap < 20) gap = 20;
                    fixedOffsetRef.current = gap;
                }
                bubbleLeftPos = (colRect.right - parentRect.left) + fixedOffsetRef.current;
            } else {
                bubbleLeftPos = parentRect.width - (BUBBLE_WIDTH + RIGHT_MARGIN);
            }

            // Apply Jitter
            bubbleLeftPos += horizontalJitter;

            // SAFETY CLAMP: Ensure bubble never exceeds the right boundary of the parent container
            const maxAllowedLeft = parentRect.width - BUBBLE_WIDTH - 20; // 20px padding from edge
            if (bubbleLeftPos > maxAllowedLeft) {
                bubbleLeftPos = maxAllowedLeft;
            }
            const endX = bubbleLeftPos;

            setBubblePosition({ top: bubbleTop, left: bubbleLeftPos });

            // Generate Path with "Flat" trailing segment and OBSTACLE AVOIDANCE
            // Smoother Curve: Increase distance to 120px
            const CURVE_WIDTH = 120;
            let breakoutX = endX - CURVE_WIDTH;

            // Ensure we don't start curving before we've even left the start text area reasonably
            breakoutX = Math.max(breakoutX, startX + 40);

            // OBSTACLE AVOIDANCE logic...
            const pathTop = Math.min(startY, endY);
            const pathBottom = Math.max(startY, endY);

            const relevantObstacles = obstacles.filter(o => {
                if (o.id === explainer.id) return false;
                const oBottom = o.top + o.height;
                const overlap = (o.top < pathBottom) && (oBottom > pathTop);
                return overlap;
            });

            if (relevantObstacles.length > 0) {
                const baseLeft = bubbleLeftPos - horizontalJitter;
                const minObstacleLeft = Math.min(...relevantObstacles.map(o => baseLeft + o.relativeLeft));
                const safeX = minObstacleLeft - 40;
                breakoutX = Math.min(breakoutX, safeX);
            }

            // Adjust drop point
            const dropEndY = horizontalY - CORNER_RADIUS;

            // Generate Path
            let path = "";
            const actualCurveDist = endX - breakoutX;
            const controlDist = actualCurveDist / 2;

            const cp1x = breakoutX + controlDist;
            const cp1y = horizontalY;
            const cp2x = endX - controlDist;
            const cp2y = endY;

            path = `
                M ${startX} ${startY} 
                L ${startX} ${dropEndY}
                Q ${startX} ${horizontalY}, ${startX + CORNER_RADIUS} ${horizontalY}
                L ${breakoutX} ${horizontalY}
                C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}
            `;

            setLinePath(path);
            setIsVisible(true);
        };

        updatePosition();
        const resizeObserver = new ResizeObserver(() => { requestAnimationFrame(updatePosition); });
        resizeObserver.observe(document.body);
        const parent = document.getElementById('blueprint-content-column')?.parentElement;
        if (parent) resizeObserver.observe(parent);
        if (bubbleRef.current) resizeObserver.observe(bubbleRef.current);
        return () => { resizeObserver.disconnect(); };
    }, [explainer, index, layoutOffset, obstacles, horizontalJitter, verticalLaneOffset]); // Dependency on verticalLaneOffset ensures we re-measure when offset changes

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => { onClose(explainer.id); }, 300);
    };

    if (explainer.isHidden) return null;

    // Use passed Z-Index or fallback
    const styles = {
        top: bubblePosition.top,
        left: bubblePosition.left,
        width: BUBBLE_WIDTH,
        zIndex: explainer.zIndex || (50 + index) // Allow parent to override Z
    };

    // Calculate Line Z-Index (Just below the bubble, but above lower layers)
    const lineZIndex = (explainer.zIndex || (50 + index)) - 1;

    return (
        <React.Fragment>
            <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-visible w-full h-full" style={{ zIndex: lineZIndex }}>
                <svg className="absolute inset-0 w-full h-full overflow-visible">

                    <defs>
                        <marker id={`arrowhead-${explainer.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#A8A29E" />
                        </marker>
                    </defs>
                    <path
                        d={linePath}
                        fill="none"
                        stroke="#A8A29E"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        className={`transition-all duration-75 ${isVisible ? 'animate-draw-line' : 'opacity-0'}`}
                        style={{
                            strokeDasharray: 1500,
                            strokeDashoffset: isVisible ? 0 : 1500,
                            transition: 'stroke-dashoffset 0.8s ease-out'
                        }}
                    />
                </svg>
            </div>
            <div
                ref={bubbleRef}
                className={`absolute pointer-events-auto ease-out transform transition-opacity transition-transform duration-500
                    ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'}
                `}
                style={styles}
            >
                <div className="bg-white dark:bg-black rounded-3xl shadow-2xl overflow-hidden border border-stone-300 dark:border-stone-700">
                    <div className="bg-white dark:bg-black p-4 flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium tracking-tight text-xl text-stone-900 dark:text-stone-100 leading-tight truncate pr-2">
                                {explainer.type === 'video' ?
                                    (currentVideo ? currentVideo.title : 'Searching for videos...') :
                                    explainer.type === 'question' ? `Ask a question about ${explainer.term}` :
                                        `${explainer.term} explained`
                                }
                            </h3>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {explainer.type === 'video' && rankedVideos.length > 1 && (
                                <button
                                    onClick={handleReroll}
                                    disabled={isRerolling}
                                    className={`p-1 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-600 transition-colors`}
                                    title="Show next video"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isRerolling ? 'animate-spin' : ''}`} />
                                </button>
                            )}
                            <button
                                onClick={handleClose}
                                className="p-1 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-stone-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>


                    <div className="p-5 max-h-[60vh] overflow-y-auto">
                        {explainer.type === 'video' ? (
                            <div className="space-y-4">
                                {showVideoTypeSelector ? (
                                    <div className="space-y-5">
                                        {isGeneratingQueries ? (
                                            <div className="flex flex-col items-center justify-center py-8 text-stone-500">
                                                <RefreshCw className="w-6 h-6 animate-spin mb-3" />
                                                <span>Generating search queries...</span>
                                            </div>
                                        ) : generatedQueries.length > 0 ? (
                                            <>
                                                <h4 className="text-base font-semibold text-stone-700 dark:text-stone-200 mb-4">
                                                    What would you like to learn about {explainer.term}?
                                                </h4>

                                                <div className="space-y-3">
                                                    {generatedQueries.map((query, index) => (
                                                        <label
                                                            key={index}
                                                            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedQuery === query
                                                                ? 'border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800'
                                                                : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
                                                                }`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="videoQuery"
                                                                value={query}
                                                                checked={selectedQuery === query}
                                                                onChange={(e) => setSelectedQuery(e.target.value)}
                                                                className="mt-0.5 w-4 h-4 text-stone-900 dark:text-stone-100 focus:ring-stone-900 dark:focus:ring-stone-100"
                                                            />
                                                            <span className="text-sm text-stone-700 dark:text-stone-200 leading-snug">
                                                                {query}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={fetchVideos}
                                                    disabled={!selectedQuery}
                                                    className="w-full py-3 px-4 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg font-semibold text-sm hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-stone-900 dark:disabled:hover:bg-stone-100"
                                                >
                                                    Find Videos
                                                </button>
                                            </>
                                        ) : (
                                            <div className="space-y-5">
                                                <h4 className="text-base font-semibold text-stone-700 dark:text-stone-200 mb-4">
                                                    What type of video are you looking for?
                                                </h4>

                                                <div className="space-y-3">
                                                    {[
                                                        { value: 'beginner-overview', label: 'Beginner overview (I don\'t even know where to start)' },
                                                        { value: 'visualization', label: 'I need help visualizing this' },
                                                        { value: 'math-explanation', label: 'Show me how the math works' },
                                                        { value: 'real-world', label: 'Let me see real world applications of this' }
                                                    ].map((option) => (
                                                        <label
                                                            key={option.value}
                                                            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedVideoType === option.value
                                                                ? 'border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800'
                                                                : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
                                                                }`}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="videoType"
                                                                value={option.value}
                                                                checked={selectedVideoType === option.value}
                                                                onChange={(e) => setSelectedVideoType(e.target.value)}
                                                                className="mt-0.5 w-4 h-4 text-stone-900 dark:text-stone-100 focus:ring-stone-900 dark:focus:ring-stone-100"
                                                            />
                                                            <span className="text-sm text-stone-700 dark:text-stone-200 leading-snug">
                                                                {option.label}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={fetchVideos}
                                                    disabled={!selectedVideoType}
                                                    className="w-full py-3 px-4 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg font-semibold text-sm hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-stone-900 dark:disabled:hover:bg-stone-100"
                                                >
                                                    Find Videos
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : isLoadingVideos ? (
                                    <div className="flex items-center justify-center p-8 text-stone-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                                        Finding the best videos...
                                    </div>
                                ) : currentVideo ? (
                                    <>
                                        <div
                                            onClick={() => window.open(currentVideo.url, '_blank')}
                                            className="cursor-pointer group/card"
                                        >
                                            <div className="flex flex-row gap-5">
                                                {/* Left Column: Thumbnail & Rating */}
                                                <div className="w-40 flex-shrink-0 flex flex-col gap-3">
                                                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black group/video shadow-sm border border-stone-100 dark:border-stone-800">
                                                        {getThumbnail(currentVideo) ? (
                                                            <img
                                                                src={getThumbnail(currentVideo)}
                                                                alt={currentVideo.title}
                                                                className="w-full h-full object-cover opacity-90 group-hover/card:opacity-100 transition-opacity"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-stone-800 text-stone-500">
                                                                <Play className="w-8 h-8" />
                                                            </div>
                                                        )}

                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover/card:bg-black/5 transition-colors">
                                                            <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white ring-1 ring-white/20">
                                                                <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                                                            </div>
                                                        </div>
                                                        {currentVideo.duration && (
                                                            <div className="absolute bottom-1.5 right-1.5 px-1 pb-[1px] bg-black/70 text-white text-[9px] font-bold rounded tracking-wide">
                                                                {formatDuration(currentVideo.duration)}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Star Rating (Centered below thumb) */}
                                                    <div className="flex items-center justify-between px-1">
                                                        <div className="flex items-center gap-0.5">
                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                <div key={star}>
                                                                    <Star
                                                                        className={`w-3 h-3 ${star <= (currentVideo.average_rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-stone-200 dark:text-stone-700'}`}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <span className="text-xs text-stone-400 font-medium ml-1">
                                                            {currentVideo.average_rating ? currentVideo.average_rating.toFixed(1) : 'NR'}
                                                            <span className="text-[10px] opacity-70 ml-0.5">({currentVideo.rating_count || 0})</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Right Column: Description & Footer */}
                                                <div className="flex-1 flex flex-col justify-between min-w-0">
                                                    <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-4">
                                                        {currentVideo.match_explanation || currentVideo.description || "No description available."}
                                                    </p>

                                                    <div className="flex items-center justify-between pt-3 mt-1 active:mt-1">
                                                        <span className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 text-[9px] font-bold uppercase tracking-wider rounded">
                                                            {currentVideo.platform || 'VIDEO'}
                                                        </span>

                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-[#FF4A1C] group-hover/card:text-[#e0390c] transition-colors uppercase tracking-wide">
                                                            OPEN
                                                            <ExternalLink className="w-3 h-3" />
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Debug Information */}
                                        {debugInfo && (
                                            <div className="mt-4 space-y-2">
                                                <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2">
                                                    Debug Information
                                                </div>

                                                {/* Embedding Query Text */}
                                                <div>
                                                    <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                                                        Embedding Query Text (used to find videos):
                                                    </label>
                                                    <textarea
                                                        readOnly
                                                        value={debugInfo.embedding_query_text}
                                                        className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 font-mono resize-none"
                                                        rows="3"
                                                    />
                                                </div>

                                                {/* Resource Info */}
                                                <div>
                                                    <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                                                        Resource Returned:
                                                    </label>
                                                    <textarea
                                                        readOnly
                                                        value={debugInfo.resource_info}
                                                        className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 font-mono resize-none"
                                                        rows="2"
                                                    />
                                                </div>

                                                {/* User Query */}
                                                <div>
                                                    <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                                                        What You Were Looking For:
                                                    </label>
                                                    <textarea
                                                        readOnly
                                                        value={debugInfo.user_query}
                                                        className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 font-mono resize-none"
                                                        rows="2"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center p-4 text-stone-500 space-y-3">
                                        <p>No videos found for this term.</p>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                console.log(`[ExplainerOverlay] 🖱️ "Activate Webhook" Clicked for: "${explainer.term}"`);

                                                try {
                                                    const webhookUrl = 'https://hook.us2.make.com/4biukvihdmvo4aianlpqk5sbnewjbonh';
                                                    const term = explainer.term || 'Unknown Term';
                                                    const context = explainer.context || 'general engineering';
                                                    const query = `${term} with respect to ${context}`;

                                                    const payload = {
                                                        section_title: context,
                                                        units: [{
                                                            unit_id: 'manual_explainer_debug',
                                                            topic: term,
                                                            target_resource_profile: query,
                                                            search_query: query
                                                        }],
                                                        query_index: 1,
                                                        total_queries: 1,
                                                        triggered_at: new Date().toISOString()
                                                    };

                                                    console.log('[ExplainerOverlay] 📡 Sending Payload:', payload);

                                                    const res = await fetch(webhookUrl, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify(payload)
                                                    });

                                                    if (res.ok) {
                                                        console.log('[ExplainerOverlay] ✅ Webhook Sent Successfully');
                                                        alert('Webhook Sent! Check Make.com.');
                                                    } else {
                                                        console.error('[ExplainerOverlay] ❌ Webhook Failed:', res.status);
                                                        alert('Webhook Failed. Check Console.');
                                                    }
                                                } catch (err) {
                                                    console.error('[ExplainerOverlay] ❌ Error:', err);
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition"
                                        >
                                            Activate Webhook
                                        </button>
                                    </div>
                                )}
                            </div>

                        ) : explainer.type === 'question' ? (
                            <div className="flex flex-col h-full">
                                {/* Chat Messages Container */}
                                <div className="flex-1 max-h-[300px] overflow-y-auto space-y-3 mb-4 pr-1">
                                    {chatMessages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${msg.role === 'user'
                                                    ? 'bg-stone-900 dark:bg-stone-800 text-white rounded-br-md'
                                                    : 'bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-bl-md'
                                                    }`}
                                            >
                                                {msg.content.split(/(\$[^$]+\$)/g).map((part, i) => {
                                                    if (part.startsWith('$') && part.endsWith('$')) {
                                                        const mathContent = part.slice(1, -1);
                                                        return (
                                                            <span key={i} className="inline-block mx-0.5">
                                                                <InlineMath math={mathContent} />
                                                            </span>
                                                        );
                                                    }
                                                    return <span key={i}>{part}</span>;
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    {isLoadingAnswer && (
                                        <div className="flex justify-start">
                                            <div className="bg-stone-100 dark:bg-stone-700 text-stone-500 px-3 py-2 rounded-2xl rounded-bl-md text-sm flex items-center gap-2">
                                                <Sparkles className="w-3 h-3 animate-spin" />
                                                Thinking...
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={isLoadingAnswer}
                                        className="w-full px-4 py-3 pr-12 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-[#FF4A1C]/20 focus:border-[#FF4A1C] outline-none transition-all text-stone-700 dark:text-stone-200 placeholder:text-stone-400 disabled:opacity-50"
                                        placeholder="Type your question..."
                                    />
                                    <button
                                        onClick={handleSendQuestion}
                                        disabled={isLoadingAnswer || !chatInput.trim()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#FF4A1C] text-white rounded-lg hover:bg-[#E03E15] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className={`text-stone-600 dark:text-stone-300 leading-relaxed overflow-hidden transition-all duration-300 relative ${isExpanded ? '' : 'max-h-24'}`}>
                                    {isLoadingExplanation ? (
                                        <span className="flex items-center gap-2 text-stone-500 italic">
                                            <Sparkles className="w-4 h-4 animate-spin" />
                                            Generating succinct explanation...
                                        </span>
                                    ) : (
                                        explanation ? (
                                            <>
                                                <div className="space-y-4">
                                                    {explanation.split('\n\n').map((paragraph, idx) => (
                                                        <p key={idx}>
                                                            {paragraph.split(/(\$[^$]+\$)/g).map((part, i) => {
                                                                if (part.startsWith('$') && part.endsWith('$')) {
                                                                    const mathContent = part.slice(1, -1);
                                                                    return (
                                                                        <span key={i} className="inline-block mx-0.5">
                                                                            <InlineMath math={mathContent} />
                                                                        </span>
                                                                    );
                                                                }
                                                                return <span key={i}>{part}</span>;
                                                            })}
                                                        </p>
                                                    ))}
                                                </div>
                                                {!isExpanded && (
                                                    <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-white dark:from-black to-transparent pointer-events-none" />
                                                )}
                                            </>
                                        ) : (
                                            "Waiting for explanation..."
                                        )
                                    )}
                                </div>
                                {explanation && !isLoadingExplanation && (
                                    <button
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        className="text-xs font-bold text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 uppercase tracking-wide flex items-center gap-1 transition-colors"
                                    >
                                        {isExpanded ? (
                                            <>
                                                Show less
                                                <ChevronUp className="w-3 h-3" />
                                            </>
                                        ) : (
                                            <>
                                                Show more
                                                <ChevronDown className="w-3 h-3" />
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </React.Fragment >
    );
};

const ExplainerOverlay = () => {
    const { explainers, removeExplainer } = useUiState();

    // Layout State
    const [bubbleMetrics, setBubbleMetrics] = useState({});
    const [bubbleShifts, setBubbleShifts] = useState({});
    const [laneOffsets, setLaneOffsets] = useState({}); // New: Store calculated lane offsets
    const [zIndices, setZIndices] = useState({}); // New: Store collision-aware Z-indices

    const getJitter = (id, index) => {
        if (index === 0) return 0;

        // Pattern: Left, Left, Right, Right, Center...
        // Sequence Indices: 1, 2, 3, 4, 5...
        // Modulo 5 mapping:
        // 1 & 2 -> Left
        // 3 & 4 -> Right
        // 0 -> Center

        // Deterministic randomness based on ID for variation within the zone
        const hash = id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const pseudoRandom = Math.sin(hash) * 10000;
        const randomVal = pseudoRandom - Math.floor(pseudoRandom); // 0.0 to 1.0

        const mod = index % 5;
        let offset = 0;

        if (mod === 1 || mod === 2) {
            // Far Left: -80px to -160px
            offset = -(80 + (randomVal * 80));
        } else if (mod === 3 || mod === 4) {
            // Far Right: 80px to 160px
            offset = 80 + (randomVal * 80);
        } else {
            // Center (occasional): -40px to 40px
            offset = (randomVal * 80) - 40;
        }

        return offset;
    };

    // Update to handle startY/startX
    const handleLayoutUpdate = (id, metrics) => {
        setBubbleMetrics(prev => {
            const existing = prev[id];
            if (existing &&
                Math.abs(existing.idealY - metrics.idealY) < 2 &&
                Math.abs(existing.height - metrics.height) < 2 &&
                Math.abs((existing.startY || 0) - metrics.startY) < 2
            ) {
                return prev;
            }
            return { ...prev, [id]: metrics };
        });
    };

    const [obstacles, setObstacles] = useState([]);

    useEffect(() => {
        const activeBubbles = explainers
            .filter(e => !e.isHidden && bubbleMetrics[e.id])
            .map((e, idx) => ({
                id: e.id,
                ...bubbleMetrics[e.id],
                index: idx
            }));

        if (activeBubbles.length === 0) {
            setBubbleShifts({});
            setObstacles([]);
            setLaneOffsets({});
            return;
        }

        // 1. Solve Vertical Overlaps
        // Sort keys: 
        // 1. Vertical Position (startY) - STABILITY FIX: Use Anchor Y instead of Bubble Y to prevent flipping when content resizes
        // 2. Horizontal Position (startX) - "Hierarchy": Right-most should be Top-most (Smallest Y)
        activeBubbles.sort((a, b) => {
            const yDiff = a.startY - b.startY;
            // If they are on roughly the same line (e.g. within 10px)
            if (Math.abs(yDiff) < 10) {
                // If they are on the SAME WORD (very close StartX)
                // Sort by idealY (Visual Top) so the upper one covers the lower one
                if (Math.abs(a.startX - b.startX) < 5) {
                    return a.idealY - b.idealY;
                }

                // Otherwise: Right (Large X) comes first (Top)
                // Left (Small X) comes last (Bottom)
                return b.startX - a.startX;
            }
            return yDiff;
        });

        // CALCULATE Z-INDICES BASED ON SORT ORDER
        // Topmost (First in array, Rank 0) -> Highest Z
        // This ensures visual stacking matches the "Line" hierarchy (Top line on top of Bottom line)
        const newZIndices = {};
        activeBubbles.forEach((b, i) => {
            // Base Z is 50. Add inverse index.
            newZIndices[b.id] = 50 + (activeBubbles.length - i);
        });
        setZIndices(newZIndices);

        const GAP = 20;
        const shifts = {};
        activeBubbles.forEach(b => shifts[b.id] = 0);

        let iterations = 0;
        let hasOverlap = true;
        while (hasOverlap && iterations < 10) {
            hasOverlap = false;
            for (let i = 0; i < activeBubbles.length - 1; i++) {
                const a = activeBubbles[i];
                const b = activeBubbles[i + 1];
                const aTop = a.idealY + shifts[a.id];
                const aBottom = aTop + a.height;
                const bTop = b.idealY + shifts[b.id];
                if (aBottom + GAP > bTop) {
                    hasOverlap = true;
                    const overlapCheck = (aBottom + GAP) - bTop;
                    shifts[a.id] -= overlapCheck / 2;
                    shifts[b.id] += overlapCheck / 2;
                }
            }
            iterations++;
        }
        setBubbleShifts(shifts);

        // 2. Solve "Lane" Conflicts (Cascading lines)
        // Group by StartY (threshold 5px)
        const LANE_THRESHOLD = 5;
        const groupLanes = {}; // key: startY (rounded), val: [bubble]

        activeBubbles.forEach(b => {
            // Find a matching lane key or create new
            let matchedKey = Object.keys(groupLanes).find(k => Math.abs(parseFloat(k) - b.startY) < LANE_THRESHOLD);
            if (!matchedKey) {
                matchedKey = b.startY.toString();
                groupLanes[matchedKey] = [];
            }
            groupLanes[matchedKey].push(b);
        });

        const newLaneOffsets = {};

        // Process each lane
        Object.values(groupLanes).forEach(group => {
            if (group.length <= 1) {
                group.forEach(b => newLaneOffsets[b.id] = 0);
                return;
            }

            // Sort by StartX (Left to Right), with Index (Creation Order) as stable tie-breaker
            group.sort((a, b) => (a.startX - b.startX) || (a.index - b.index));

            // "Farthest left will go under the next one" - User Correction: "Left side text are supposed to be under"
            // So: Leftmost (index 0) should be Lowest (Max Offset).
            // Rightmost (index N) should be Highest (Min Offset).

            group.forEach((b, i) => {
                newLaneOffsets[b.id] = (group.length - 1 - i) * 6;
            });
        });

        setLaneOffsets(newLaneOffsets);


        // 3. Obstacles
        const calculatedObstacles = activeBubbles.map(b => {
            const originalIndex = explainers.findIndex(e => e.id === b.id);
            const jitter = getJitter(b.id, originalIndex);

            // IMPORTANT: Obstacle Top depends on SHIFT, not lane offset (lane offset affects line, not bubble pos... 
            // wait, in child we add laneOffset to bubbleTop logic? Yes.)
            // Child: bubbleTop = idealBubbleTop + layoutOffset.
            // But idealBubbleTop = horizontalY - ...
            // And horizontalY = startY + DROP_HEIGHT + laneOffset.
            // So Yes, laneOffset DOES shift the bubble down.
            // We need to account for that in obstacle calc.

            // But wait, shifts[b.id] was calculated based on idealY WITHOUT laneOffset (in step 1).
            // If we add laneOffset now, we might re-introduce overlapping bubbles?
            // Since step 1 didn't know about lane offsets.
            // For small lane offsets (6px), maybe it's fine.
            // For correctness, we should include laneOffset in the overlap solver.
            // But simpler to just apply it and assume gap is enough.

            const laneOff = newLaneOffsets[b.id] || 0;

            return {
                id: b.id,
                top: b.idealY + shifts[b.id], // FIX: idealY already includes laneOffset. Do not add it twice.
                height: b.height,
                jitter: jitter,
                relativeLeft: jitter
            };
        });

        setObstacles(calculatedObstacles.map(o => ({
            id: o.id,
            top: o.top,
            height: o.height,
            relativeLeft: o.relativeLeft
        })));


    }, [explainers, bubbleMetrics]);

    return (
        <div
            className="absolute inset-0 z-40 pointer-events-none overflow-visible"
            style={{ width: '100%', height: '100%' }}
        >
            {explainers.map((explainer, index) => {
                const jitter = getJitter(explainer.id, index);
                // Inject the calculated Z-index
                const explainerWithZ = { ...explainer, zIndex: zIndices[explainer.id] };

                return (
                    <ExplainerBubble
                        key={explainerWithZ.id}
                        explainer={explainerWithZ}
                        index={index}
                        onClose={removeExplainer}
                        onLayoutUpdate={handleLayoutUpdate}
                        layoutOffset={bubbleShifts[explainer.id] || 0}
                        verticalLaneOffset={laneOffsets[explainer.id] || 0} // Pass lane offset
                        horizontalJitter={jitter}
                        obstacles={obstacles}
                    />
                );
            })}

            <style>{`
                @keyframes draw-line {
                    to { stroke-dashoffset: 0; }
                }
            `}</style>
        </div>
    );
};

export default ExplainerOverlay;
