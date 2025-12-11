import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Zap, Target, BookOpen, BarChart } from 'lucide-react';
import BlueprintModal from '../components/BlueprintModal';

const steps = [
  {
    id: 1,
    title: "Assess Current Standing",
    description: "We analyze your syllabus and current grades to understand exactly where you stand.",
    icon: <BarChart className="w-full h-full text-white" />,
    color: "bg-blue-500"
  },
  {
    id: 2,
    title: "Identify Knowledge Gaps",
    description: "We pinpoint specific weak areas and concepts that need immediate attention.",
    icon: <Target className="w-full h-full text-white" />,
    color: "bg-purple-500"
  },
  {
    id: 3,
    title: "Build Custom Schedule",
    description: "We create a personalized study roadmap tailored to your exam dates and learning style.",
    icon: <BookOpen className="w-full h-full text-white" />,
    color: "bg-green-500"
  },
  {
    id: 4,
    title: "Execute and Crush It",
    description: "Follow the plan, track your progress, and walk into your exams with total confidence.",
    icon: <Zap className="w-full h-full text-white" />,
    color: "bg-orange-500"
  }
];

const Classes = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(1);
  const [isAutoCycling, setIsAutoCycling] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let interval;
    if (isAutoCycling) {
      interval = setInterval(() => {
        setActiveStep((prev) => (prev % steps.length) + 1);
      }, 3000); // Switch every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isAutoCycling]);

  const handleStepClick = (id) => {
    setActiveStep(id);
    setIsAutoCycling(false); // Stop auto-cycling if user interacts
  };

  return (
    <div className="min-h-screen bg-[#F8F4E3] px-6 lg:px-12 pt-16 pb-24 lg:pt-24 lg:pb-32">
      {isModalOpen && <BlueprintModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />}
      {/* Header Section */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-[#2A2B2A] mb-8 ">
          Crush Your <br />
          <span className="text-stone-400">Engineering</span> Classes.
        </h1>
        
        <div className="flex justify-center gap-6 mb-16 flex-wrap">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-4 bg-[#FF4A1C] hover:bg-[#e03e15] text-white rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center gap-2 group"
          >
            Create a Blueprint
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-8 py-4 bg-[#2A2B2A] hover:bg-[#1a1b1a] text-white rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center gap-2 group"
          >
            Go to Dashboard
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Interactive Process Section */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Steps List */}
          <div className="space-y-6">
            {steps.map((step) => (
              <div
                key={step.id}
                onClick={() => handleStepClick(step.id)}
                className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 border-2 ${
                  activeStep === step.id
                    ? 'bg-white border-[#FF4A1C] shadow-lg scale-102'
                    : 'bg-white/50 border-transparent hover:bg-white hover:border-stone-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                    activeStep === step.id
                      ? 'bg-[#FF4A1C] text-white border-[#FF4A1C]'
                      : 'bg-transparent text-stone-400 border-stone-300'
                  }`}>
                    {step.id}
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold mb-2 ${
                      activeStep === step.id ? 'text-[#2A2B2A]' : 'text-stone-500'
                    }`}>
                      {step.title}
                    </h3>
                    <p className={`text-sm leading-relaxed ${
                      activeStep === step.id ? 'text-stone-600' : 'text-stone-400'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                  
                  
                </div>
                
                {/* Progress bar for active step */}
              </div>
            ))}
          </div>

          {/* Graphic Display */}
          <div className="relative h-[500px] w-full bg-[#2A2B2A] rounded-3xl overflow-hidden shadow-2xl p-8 flex items-center justify-center">
             {/* Background decoration */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF4A1C]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
             <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

             {/* Content */}
             <div key={activeStep} className="relative z-10 text-center animate-fade-in-up">
                <div className={`w-32 h-32 mx-auto mb-8 rounded-2xl shadow-xl flex items-center justify-center p-6 ${steps[activeStep-1].color}`}>
                  {steps[activeStep-1].icon}
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">{steps[activeStep-1].title}</h2>
                <p className="text-stone-400 text-lg max-w-md mx-auto">
                  Visualization of step {activeStep}: {steps[activeStep-1].description}
                </p>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Classes;
