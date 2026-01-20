import React from 'react';

const BlueprintLanding = ({
    title,
    children
}) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] w-full px-4 animate-fade-in">
            <div className="w-full max-w-full px-8 text-center space-y-12">

                {/* Header Section */}
                <div className="space-y-6">
                    <h1 className="text-6xl md:text-7xl font-bold text-[#2A2B2A] dark:text-white tracking-tight" style={{ fontFamily: '"Outfit", sans-serif' }}>
                        {title || "Blueprint"}
                    </h1>

                    <p className="text-xl md:text-2xl text-stone-500 dark:text-stone-400 font-light max-w-2xl mx-auto leading-relaxed">
                        Master this topic by following the <span className="text-[#FF4A1C] font-normal">step-by-step roadmap</span> below.
                    </p>
                </div>

                {/* The Flowmap Container */}
                <div className="w-full relative py-8">
                    {/* Decorative background elements if needed */}
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-stone-200 dark:via-stone-800 to-transparent -z-10 transform -translate-y-1/2 opacity-50" />

                    {children}
                </div>

                {/* Start Prompt */}
                <div className="animate-bounce">
                    <p className="text-sm uppercase tracking-widest text-stone-400 font-medium">
                        Select a module to begin
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BlueprintLanding;
