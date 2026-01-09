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

    const value = {
        chatState,
        setChatOpen
    };

    return (
        <UiStateContext.Provider value={value}>
            {children}
        </UiStateContext.Provider>
    );
};
