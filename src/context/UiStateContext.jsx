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

    const [explainer, setExplainer] = useState({
        isOpen: false,
        term: null,
        anchorRect: null,
        anchorElement: null, // Add anchorElement to track position on scroll
        id: null
    });

    const value = {
        chatState,
        setChatOpen,
        explainer,
        setExplainer
    };

    return (
        <UiStateContext.Provider value={value}>
            {children}
        </UiStateContext.Provider>
    );
};
