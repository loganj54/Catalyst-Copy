import React, { useState, useEffect } from 'react';
import { X, BookOpen, User } from 'lucide-react';

const CreateClassModal = ({ isOpen, onClose, onSubmit, initialData = null }) => {
  if (!isOpen) return null;

  const [className, setClassName] = useState('');
  const [professor, setProfessor] = useState('');

  useEffect(() => {
    if (initialData) {
      setClassName(initialData.name || '');
      setProfessor(initialData.professor || '');
    } else {
      setClassName('');
      setProfessor('');
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (className.trim()) {
      onSubmit({ 
        className, 
        professor,
        id: initialData?.id // Pass back ID if editing
      });
      if (!initialData) {
        setClassName('');
        setProfessor('');
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-scale-in overflow-hidden">
        <div className="p-4 flex justify-end bg-white/80 backdrop-blur-md z-10">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-500" />
          </button>
        </div>

        <div className="px-8 pb-8">
          <h2 className="text-2xl font-bold text-[#2A2B2A] mb-6">
            {initialData ? 'Edit Class' : 'Create New Class'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-600 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Class Name
              </label>
              <input 
                type="text" 
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full p-3 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/20 focus:border-[#FF4A1C] transition-all"
                placeholder="e.g. Calculus I"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-600 flex items-center gap-2">
                <User className="w-4 h-4" /> Professor Name (Optional)
              </label>
              <input 
                type="text" 
                value={professor}
                onChange={(e) => setProfessor(e.target.value)}
                className="w-full p-3 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/20 focus:border-[#FF4A1C] transition-all"
                placeholder="e.g. Dr. Smith"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-[#2A2B2A] hover:bg-black text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl mt-4"
            >
              {initialData ? 'Save Changes' : 'Create Class'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateClassModal;
