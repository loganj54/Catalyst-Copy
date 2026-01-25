import React, { createContext, useContext, useState } from 'react';

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

    const addExplainer = (newExplainer) => {
        setExplainers(prev => {
            // Check if already exists by ID or Term/Unit combination to prevent duplicates if needed
            const exists = prev.find(e => e.id === newExplainer.id);
            if (exists) return prev;
            return [...prev, { ...newExplainer, isOpen: true, isHidden: false }];
        });
    };

    const removeExplainer = (id) => {
        setExplainers(prev => prev.filter(e => e.id !== id));
    };

    const updateExplainer = (id, updates) => {
        setExplainers(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    };

    const value = {
        chatState,
        setChatOpen,
        explainers,
        addExplainer,
        removeExplainer,
        updateExplainer
    };

    return (
        <UiStateContext.Provider value={value}>
            {children}
        </UiStateContext.Provider>
    );
};
