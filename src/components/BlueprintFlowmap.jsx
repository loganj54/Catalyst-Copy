import React, { useMemo, useRef, useEffect } from 'react';
import {
    ArrowRight,
    MapPin,
    BookOpen,
    CheckCircle,
    Target,
    Flag,
    Sparkles,
    Layers
} from 'lucide-react';



const BlueprintFlowmap = ({
    structure,
    units, // NEW: Optional units list for Content Mode
    activeSectionId, // For Landing/Section Mode
    activeUnitId, // For Content/Unit Mode
    onSelectSection,
    onSelectUnit, // NEW: Handler for unit selection
    viewMode = 'landing', // 'landing' | 'content'
    className = ''
}) => {
    const scrollContainerRef = useRef(null);

    // Generate Nodes based on Mode (Section vs Unit)
    const flowNodes = useMemo(() => {
        const nodes = [];

        // MODE 1: Content Mode (Unit Level Navigation)
        if (units && units.length > 0) {
            units.forEach((unit, idx) => {
                let nodeType = 'learn';
                if (unit.unit_type === 'walkthrough' || unit.unit_type === 'problem') nodeType = 'solve';
                if (unit.topic?.toLowerCase().includes('practice')) nodeType = 'practice';

                nodes.push({
                    id: unit.unit_id,
                    type: nodeType,
                    label: unit.topic || `Topic ${idx + 1}`,
                    description: '', // Units might not have descriptions handy, or we could use duration
                    data: unit
                });
            });

            return nodes;
        }

        // MODE 2: Landing Mode (Section Level Navigation)
        if (structure) {
            // Start Node removed as per request (First section is start)

            const structData = structure.structure_data || structure.structure || structure;

            // Prerequisites Section (if exists)
            if (structData?.prerequisites_section) {
                nodes.push({
                    id: 'prerequisites',
                    type: 'prereq', // Changed from 'learn' to 'prereq'
                    label: 'Prerequisites',
                    description: 'Foundational concepts',
                    section: structData.prerequisites_section
                });
            }

            // Content Sections (Problem 1, 2, etc.)
            if (structData?.content_sections) {
                structData.content_sections.forEach((section, sIdx) => {
                    let nodeType = 'solve';
                    if (section.title?.toLowerCase().includes('practice') || section.title?.toLowerCase().includes('challenge')) {
                        nodeType = 'practice';
                    }

                    nodes.push({
                        id: section.section_id || `section-${sIdx}`,
                        type: nodeType,
                        label: section.title || `Section ${sIdx + 1}`,
                        description: `${section.learning_units?.length || 0} Topics`,
                        section: section
                    });
                });
            }

            return nodes;
        }

        return [];
    }, [structure, units]); // depend on units/structure

    // Scroll to active node
    useEffect(() => {
        const activeId = viewMode === 'content' ? activeUnitId : activeSectionId;

        if (activeId && scrollContainerRef.current) {
            const index = flowNodes.findIndex(n => n.id === activeId);
            if (index > -1) {
                const container = scrollContainerRef.current;
                // Safely access element
                const scrollWrapper = container.firstElementChild;
                if (scrollWrapper && scrollWrapper.children[index]) {
                    scrollWrapper.children[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }
        }
    }, [activeSectionId, activeUnitId, flowNodes, viewMode]);


    // Helper for node styles
    const getNodeStyles = (node, isActive) => {
        const isLanding = viewMode === 'landing';
        const isContent = viewMode === 'content';

        // Base classes
        let classes = `
      relative flex flex-col items-center justify-center 
      transition-all duration-300 cursor-pointer
      border-2 shrink-0
    `;

        // Size & Shape
        if (isLanding) {
            // SQUARE MODULES (w-64 = 16rem, h-64 = 16rem)
            classes += ' w-64 h-64 rounded-2xl p-4 gap-2';
        } else if (isContent) {
            classes += ' w-48 h-48 rounded-xl p-4 gap-2';
        } else {
            classes += ' w-40 h-24 rounded-xl p-2 gap-1';
        }

        // Color/Theme

        switch (node.type) {
            case 'start':
            case 'end':
                classes += isActive
                    ? ' bg-stone-900 border-stone-900 text-white shadow-xl scale-105'
                    : ' bg-stone-100 border-stone-200 text-stone-500 hover:border-stone-400 hover:scale-105';
                break;
            case 'prereq': // New Case for Prerequisites
                classes += isActive
                    ? ' bg-white border-stone-500 text-stone-900 shadow-xl scale-105 ring-1 ring-stone-900/5' // White active state
                    : ' bg-white border-stone-200 text-stone-600 hover:border-stone-400 hover:shadow-md hover:scale-105'; // Standard hover effects
                break;
            case 'learn':
                classes += isActive
                    ? ' bg-blue-50 border-blue-500 text-blue-900 shadow-[0_0_20px_rgba(59,130,246,0.3)] scale-105'
                    : ' bg-white border-blue-200 text-stone-600 hover:border-blue-400 hover:shadow-md hover:scale-105';
                break;
            case 'solve': // For Problems
                classes += isActive
                    ? ' bg-green-50 border-green-500 text-green-900 shadow-[0_0_20px_rgba(34,197,94,0.3)] scale-105'
                    : ' bg-white border-green-200 text-stone-600 hover:border-green-400 hover:shadow-md hover:scale-105';
                break;
            case 'practice':
                classes += isActive
                    ? ' bg-orange-50 border-orange-500 text-orange-900 shadow-[0_0_25px_rgba(249,115,22,0.5)] scale-105 ring-2 ring-orange-200'
                    : ' bg-white border-orange-200 text-stone-600 hover:border-orange-400 hover:shadow-[0_0_15px_rgba(249,115,22,0.2)] hover:scale-105';
                break;
            default:
                classes += ' bg-white border-stone-200 text-stone-600';
        }

        // Content Mode Compact overrides
        if (!isLanding && !isActive) {
            classes += ' opacity-80 hover:opacity-100';
        }

        return classes;
    };

    const getBannerColor = (type) => {
        switch (type) {
            case 'learn': return 'bg-blue-500';
            case 'solve': return 'bg-green-500';
            case 'practice': return 'bg-orange-500';
            default: return 'bg-stone-500';
        }
    };

    // Determine Active State
    const checkActive = (node, index) => {
        if (viewMode === 'landing') {
            return activeSectionId === node.id;
        }
        if (viewMode === 'content') {
            return activeUnitId === node.id || (!activeUnitId && index === 0);
        }
        return false;
    };

    // Handler
    const handleNodeClick = (node) => {
        if (node.type === 'start' || node.type === 'end') return;

        if (viewMode === 'landing' && onSelectSection) {
            onSelectSection(node.section);
        } else if (viewMode === 'content' && onSelectUnit) {
            onSelectUnit(node.data);
        }
    };

    return (
        <div className={`w-full overflow-x-auto pb-6 hide-scrollbar px-4 ${className} ${viewMode === 'content' ? 'py-4' : 'py-8'}`} ref={scrollContainerRef}>
            {/* Added justify-center to center the modules */}
            <div className="flex items-center justify-center gap-6 min-w-max mx-auto px-4"> {/* Increased gap for larger nodes */}
                {flowNodes.map((node, i) => {
                    const isActive = checkActive(node, i);
                    const isLast = i === flowNodes.length - 1;
                    const isFirst = i === 0;

                    return (
                        <React.Fragment key={node.id}>
                            {/* Node */}
                            <div
                                onClick={() => handleNodeClick(node)}
                                className={getNodeStyles(node, isActive)}
                            >
                                {/* Banner for Types or Start */}
                                {(isFirst || node.type === 'learn' || node.type === 'solve' || node.type === 'practice') && (
                                    <div className={`absolute -top-3 px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider shadow-sm 
                                        ${isFirst ? 'bg-stone-900 ring-2 ring-white' : getBannerColor(node.type)}`}>

                                        {/* Logic for Label: Landing = Start/Type, Content = Step #? or Type */}
                                        {isFirst ? 'Start' : (
                                            node.type === 'learn' ? 'Learn' : node.type === 'solve' ? 'Problem' : 'Practice'
                                        )}

                                        {/* Icons removed/minimized? User want full clean look. Keeping text for clarity for now. */}
                                    </div>
                                )}

                                {/* Icon Main (Optional - maybe redundant with huge text?) */}
                                <div className="mb-2 opacity-50">
                                    {node.type === 'start' && <Flag className={`w-8 h-8 ${isActive ? 'text-white' : 'text-stone-300'}`} />}
                                    {node.type === 'end' && <CheckCircle className={`w-8 h-8 ${isActive ? 'text-white' : 'text-stone-300'}`} />}
                                </div>

                                {/* Text Content - Full Filling */}
                                <div className="w-full h-full flex items-center justify-center p-2">
                                    <h3 className={`font-bold text-center leading-snug w-full whitespace-normal 
                                        ${viewMode === 'landing' ? 'text-xl' : 'text-sm md:text-base'}`}>
                                        {node.label}
                                    </h3>
                                </div>

                                {/* Description only if huge text doesn't fill it? */}
                                {viewMode === 'landing' && node.description && (
                                    <p className={`text-xs text-center mt-auto pb-2 line-clamp-2 ${isActive ? 'opacity-90' : 'opacity-60'}`}>
                                        {node.description}
                                    </p>
                                )}
                            </div>

                            {/* Connector Arrow */}
                            {!isLast && (
                                <div className="text-stone-300 dark:text-stone-600 shrink-0">
                                    <ArrowRight className={viewMode === 'content' ? 'w-6 h-6' : 'w-8 h-8'} />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default BlueprintFlowmap;


