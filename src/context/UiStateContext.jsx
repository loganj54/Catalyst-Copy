import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const UiStateContext = createContext();

export const useUiState = () => {
    const context = useContext(UiStateContext);
    if (!context) {
        throw new Error('useUiState must be used within a UiStateProvider');
    }
    return context;
};

export const UiStateProvider = ({ children }) => {
    const [chatState, setChatState] = useState({
        isOpen: false,
        width: 450 // Default width to match the new design
    });

    const setChatOpen = (isOpen) => {
        setChatState(prev => ({ ...prev, isOpen }));
    };

    const [explainers, setExplainers] = useState([]);
    const [explainersLoaded, setExplainersLoaded] = useState(false);

    // Persist explainer to database
    const persistExplainer = useCallback(async (explainer, blueprintId) => {
        if (!blueprintId) return null;

        try {
            const payload = {
                blueprint_id: blueprintId,
                explainer_type: explainer.type,
                term: explainer.term,
                context: explainer.context || null,
                solution_context: explainer.solutionContext || null,
                unit_id: explainer.unitId || null,
                anchor_rect: explainer.anchorRect || null,
                captured_scroll_top: explainer.capturedScrollTop || 0,
                cached_explanation: explainer.cachedExplanation || null,
                cached_video_data: explainer.cachedVideoData || null,
                conversation_history: explainer.conversationHistory || [],
                selected_query: explainer.selectedQuery || null,
                is_open: explainer.isOpen !== false,
                is_hidden: explainer.isHidden || false,
            };

            // If we have a dbId, update; otherwise insert
            if (explainer.dbId) {
                const { data, error } = await supabase
                    .from('blueprint_explainers')
                    .update(payload)
                    .eq('id', explainer.dbId)
                    .select()
                    .single();

                if (error) {
                    console.error('[UiState] Failed to update explainer:', error);
                    return null;
                }
                return data?.id;
            } else {
                const { data, error } = await supabase
                    .from('blueprint_explainers')
                    .insert(payload)
                    .select()
                    .single();

                if (error) {
                    console.error('[UiState] Failed to insert explainer:', error);
                    return null;
                }
                return data?.id;
            }
        } catch (err) {
            console.error('[UiState] Error persisting explainer:', err);
            return null;
        }
    }, []);

    // Delete explainer from database
    const deleteExplainerFromDb = useCallback(async (dbId) => {
        if (!dbId) return;

        try {
            const { error } = await supabase
                .from('blueprint_explainers')
                .delete()
                .eq('id', dbId);

            if (error) {
                console.error('[UiState] Failed to delete explainer:', error);
            }
        } catch (err) {
            console.error('[UiState] Error deleting explainer:', err);
        }
    }, []);

    // Load explainers from database
    const loadExplainersFromDb = useCallback(async (blueprintId) => {
        if (!blueprintId) return;

        // Clear existing explainers instantly to prevent showing data from previous pages
        setExplainers([]);
        setExplainersLoaded(false);

        try {
            const { data, error } = await supabase
                .from('blueprint_explainers')
                .select('*')
                .eq('blueprint_id', blueprintId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('[UiState] Failed to load explainers:', error);
                setExplainersLoaded(true);
                return;
            }

            if (data && data.length > 0) {
                const loadedExplainers = data.map(row => ({
                    id: row.id, // Use DB id as local id
                    dbId: row.id,
                    type: row.explainer_type,
                    term: row.term,
                    context: row.context,
                    solutionContext: row.solution_context,
                    unitId: row.unit_id,
                    blueprintId: row.blueprint_id,
                    anchorRect: row.anchor_rect,
                    capturedScrollTop: row.captured_scroll_top,
                    cachedExplanation: row.cached_explanation,
                    cachedVideoData: row.cached_video_data,
                    conversationHistory: row.conversation_history || [],
                    selectedQuery: row.selected_query,
                    isOpen: row.is_open,
                    isHidden: row.is_hidden,
                    // Position data for restored explainers
                    startPosition: row.anchor_rect ? {
                        x: row.anchor_rect.left + (row.anchor_rect.width / 2),
                        y: row.anchor_rect.top
                    } : { x: 100, y: 100 },
                    isRestored: true, // Flag to indicate this was restored from DB
                }));

                setExplainers(loadedExplainers);
            } else {
                setExplainers([]);
            }
            setExplainersLoaded(true);
        } catch (err) {
            console.error('[UiState] Error loading explainers:', err);
            setExplainersLoaded(true);
        }
    }, []);

    // Clear all explainers for a blueprint
    const clearAllExplainers = useCallback(async (blueprintId) => {
        if (blueprintId) {
            try {
                await supabase
                    .from('blueprint_explainers')
                    .delete()
                    .eq('blueprint_id', blueprintId);
            } catch (err) {
                console.error('[UiState] Error clearing explainers:', err);
            }
        }
        setExplainers([]);
    }, []);

    const addExplainer = useCallback((newExplainer) => {
        setExplainers(prev => {
            // Check if already exists by ID to prevent duplicates
            const exists = prev.find(e => e.id === newExplainer.id);
            if (exists) return prev;

            const explainerWithDefaults = {
                ...newExplainer,
                isOpen: true,
                isHidden: false,
                conversationHistory: [],
                cachedExplanation: null,
                cachedVideoData: null,
            };

            // Persist to database (fire-and-forget, then update with dbId)
            if (newExplainer.blueprintId) {
                persistExplainer(explainerWithDefaults, newExplainer.blueprintId).then(dbId => {
                    if (dbId) {
                        // Update the explainer with the database ID
                        setExplainers(current =>
                            current.map(e =>
                                e.id === newExplainer.id ? { ...e, dbId } : e
                            )
                        );
                    }
                });
            }

            return [...prev, explainerWithDefaults];
        });
    }, [persistExplainer]);

    const removeExplainer = useCallback((id) => {
        setExplainers(prev => {
            const explainer = prev.find(e => e.id === id);
            if (explainer?.dbId) {
                deleteExplainerFromDb(explainer.dbId);
            }
            return prev.filter(e => e.id !== id);
        });
    }, [deleteExplainerFromDb]);

    const updateExplainer = useCallback((id, updates, blueprintId) => {
        setExplainers(prev => prev.map(e => {
            if (e.id === id) {
                const updated = { ...e, ...updates };
                // Persist update to database
                const bpId = blueprintId || e.blueprintId;
                if (bpId && e.dbId) {
                    persistExplainer(updated, bpId);
                }
                return updated;
            }
            return e;
        }));
    }, [persistExplainer]);

    const value = {
        chatState,
        setChatOpen,
        explainers,
        explainersLoaded,
        addExplainer,
        removeExplainer,
        updateExplainer,
        loadExplainersFromDb,
        clearAllExplainers,
    };

    return (
        <UiStateContext.Provider value={value}>
            {children}
        </UiStateContext.Provider>
    );
};
