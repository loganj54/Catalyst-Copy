import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, FileText, Trash2, Sparkles, BookOpen, Briefcase, 
  ArrowRight, Layers, Command, Loader2, Paperclip
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const Create = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // State
  const [mode, setMode] = useState('classwork'); // 'classwork' or 'project'
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Form Data
  const [formData, setFormData] = useState({
    className: '',
    professorName: '',
    blueprintName: '',
    textInput: '',
    fileUpload: null
  });

  // File Handling
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelection(file);
      e.dataTransfer.clearData();
    }
  };

  const handleFileSelection = (file) => {
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setFormData(prev => ({...prev, fileUpload: file}));
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    handleFileSelection(file);
  };

  const removeFile = () => {
    setFormData(prev => ({...prev, fileUpload: null}));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!user) {
      alert('You must be logged in to create a blueprint');
      return;
    }

    // Default name if empty
    const finalBlueprintName = formData.blueprintName.trim() || `Session ${new Date().toLocaleDateString()}`;

    // Auto-generate class name if empty in classwork mode
    let finalClassName = formData.className.trim();
    if (mode === 'classwork' && !finalClassName) {
       finalClassName = "General Engineering"; // Default fallback
    }

    setLoading(true);

    try {
      let finalClassId = null;

      // 1. Create Class (if Classwork mode)
      if (mode === 'classwork') {
        // Try to find existing class or create new one (simplified for now to just create/use)
        // In a real app we might want a dropdown to select existing classes
        const { data: newClass, error: classError } = await supabase
          .from('classes')
          .insert([{
            user_id: user.id,
            name: finalClassName,
            professor: formData.professorName.trim() || null
          }])
          .select()
          .single();

        if (classError) throw classError;
        finalClassId = newClass.id;
      }

      // 2. Upload File (if present)
      let fileUrl = null;
      let documentId = null;

      if (formData.fileUpload) {
        // Simple logic for now - check duplicates later if needed
        const fileExt = formData.fileUpload.name.split('.').pop();
        const fileName = `${user.id}/${finalClassId || 'projects'}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('class-documents')
          .upload(fileName, formData.fileUpload);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('class-documents')
            .getPublicUrl(fileName);
          fileUrl = urlData.publicUrl;

          // Save metadata
          if (finalClassId) {
            const { data: newDocData } = await supabase
              .from('class_documents')
              .insert([{
                class_id: finalClassId,
                user_id: user.id,
                name: formData.fileUpload.name,
                file_path: fileName,
                file_url: fileUrl,
                file_size: formData.fileUpload.size,
                file_type: formData.fileUpload.type
              }])
              .select()
              .single();
            
            if (newDocData) documentId = newDocData.id;
          }
        }
      }

      // 3. Create Blueprint
      const content = {
        className: finalClassName,
        professorName: formData.professorName,
        blueprintName: finalBlueprintName,
        textInput: formData.textInput,
        fileUpload: formData.fileUpload ? {
          name: formData.fileUpload.name,
          size: formData.fileUpload.size,
          type: formData.fileUpload.type,
          url: fileUrl
        } : null,
        mode: mode
      };

      const { data, error } = await supabase
        .from('blueprints')
        .insert([{
          user_id: user.id,
          class_id: finalClassId, // null for project mode
          document_id: documentId,
          title: finalBlueprintName,
          description: formData.textInput,
          task_type: mode === 'project' ? 'project' : 'Auto-detect',
          file_metadata: content.fileUpload,
          content: content
        }])
        .select()
        .single();

      if (error) throw error;

      navigate(`/blueprint/${data.id}`);

    } catch (error) {
      console.error('Error creating blueprint:', error);
      alert('Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-6xl text-stone-900 mb-5 tracking-tight pt-20">
              What are we learning today?
            </h1>
            <p className="text-stone-500 text-lg pb-10 pt-10 max-w-2xl mx-auto">
              Transform PDFs and ideas into structured engineering roadmaps.
            </p>
          </div>

        {/* Main Input Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-stone-300 overflow-hidden">
          
          <div className="p-4 space-y-4">
            
            <div className="flex gap-4 h-[180px]">
              
              {/* Left Side: Upload Area (Only in Classwork Mode) */}
              {mode === 'classwork' && (
                <div className="w-1/3 shrink-0">
                  {!formData.fileUpload ? (
                    <div
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`h-full border border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                        isDragging 
                          ? 'border-stone-500 bg-stone-50' 
                          : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
                      />
                      <div className="p-2 bg-stone-100 rounded-lg text-stone-500 mb-2">
                         <Paperclip className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-medium text-stone-900">Upload file</p>
                      <p className="text-[10px] text-stone-500 mt-1">PDF, IMG, DOC (10MB)</p>
                    </div>
                  ) : (
                    <div className="h-full border border-stone-300 rounded-lg p-4 bg-stone-50 flex flex-col items-center justify-center text-center relative group">
                      <div className="p-2 bg-white border border-stone-300 rounded-lg text-[#FF4A1C] mb-2 shadow-sm">
                         <FileText className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-medium text-stone-900 line-clamp-2 px-2 break-all">
                        {formData.fileUpload.name}
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        {(formData.fileUpload.size / 1024).toFixed(1)} KB
                      </p>
                      
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(); }}
                        className="absolute top-2 right-2 p-1.5 bg-white border border-stone-300 rounded-md text-stone-500 hover:text-red-600 hover:border-red-300 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Right Side: Text Input */}
              <div className={mode === 'classwork' ? 'flex-1' : 'w-full'}>
                 <textarea
                  value={formData.textInput}
                  onChange={(e) => setFormData({...formData, textInput: e.target.value})}
                  placeholder={mode === 'classwork' 
                    ? "Or add any specific context, problem details, or questions here..." 
                    : "Describe your engineering project idea in detail..."}
                  className="w-full h-full p-3 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 resize-none focus:outline-none focus:border-stone-500 focus:ring-0 leading-relaxed transition-all"
                />
              </div>

            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-stone-300">
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('classwork')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    mode === 'classwork' 
                      ? 'bg-stone-100 text-stone-900 border-stone-300' 
                      : 'text-stone-500 border-transparent hover:bg-stone-50 hover:text-stone-900'
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  Classwork
                </button>
                <button
                  onClick={() => setMode('project')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    mode === 'project' 
                      ? 'bg-stone-100 text-stone-900 border-stone-300' 
                      : 'text-stone-500 border-transparent hover:bg-stone-50 hover:text-stone-900'
                  }`}
                >
                  <Briefcase className="w-3 h-3" />
                  Project
                </button>
              </div>
              
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white text-stone-900 border border-stone-300 rounded-lg font-medium text-sm hover:bg-stone-50 transition-all disabled:opacity-50 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <span>Create Blueprint</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Create;
