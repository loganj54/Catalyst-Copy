import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Upload, FileText, Trash2, Sparkles, BookOpen, Briefcase,
  ArrowRight, Layers, Command, Loader2, Paperclip, Plus, Check, X,
  ToggleLeft, ToggleRight, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { extractTextFromPdf, isPdfFile, isLargeFile } from '../utils/pdfExtractor';

const Create = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  // State
  const [mode, setMode] = useState('classwork'); // 'classwork' or 'project'
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Dev Mode State - Run full pipeline automatically after creation
  const [devModeEnabled, setDevModeEnabled] = useState(false);

  // Class Selection State
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [isCreatingClassLoading, setIsCreatingClassLoading] = useState(false);

  const wrapperRef = useRef(null);

  // Reset state on mode change or unmount
  useEffect(() => {
    // Check for initial class ID from navigation state
    if (location.state?.initialClassId) {
      setSelectedClassId(location.state.initialClassId);
      setMode('classwork');

      // Clean up state to prevent it from persisting if they navigate away and back
      // effectively consuming the "one-time" instruction
      window.history.replaceState({}, document.title);
    }

    return () => {
      setSelectedClassId(null);
      setIsCreatingClass(false);
      setNewClassName('');
    };
  }, []);

  // Handle clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsCreatingClass(false);
        setNewClassName('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  useEffect(() => {
    if (mode !== 'classwork') {
      setSelectedClassId(null);
      setIsCreatingClass(false);
      setNewClassName('');
    } else {
      // Re-fetch or re-establish default logic if needed
      // but 'classes' state is preserved, just selection resets or stays?
      // User said: "refresh... switching... clicking off... reset that entire box back to initial state"
      // If we switch back to classwork, we probably want it clear or default.
      // Let's clear selection on mode switch TO classwork too? 
      // Actually, user said "reset that entire... box back to initial state".
      // Initial state is no selection? Or default selection?
      // Previous logic had no default selection.
    }
  }, [mode]);

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
      // Remove alert blocker so we can show UI error instead
      setFormData(prev => ({ ...prev, fileUpload: file }));
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    handleFileSelection(file);
  };

  const removeFile = () => {
    setFormData(prev => ({ ...prev, fileUpload: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Fetch Classes
  useEffect(() => {
    if (user && mode === 'classwork') {
      fetchClasses();
    }
  }, [user, mode]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClasses(data || []);

      // Select the most recent class by default if none selected
      if (data && data.length > 0 && !selectedClassId) {
        // Optional: default select? Or leave empty? 
        // User didn't specify default, but "General Engineering" fallback exists.
        // Let's leave it unselected to force choice or fallback.
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim() || !user) return;

    setIsCreatingClassLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .insert([{
          user_id: user.id,
          name: newClassName.trim(),
          professor: null // User only asked for name
        }])
        .select()
        .single();

      if (error) throw error;

      // Add to list and select it
      setClasses(prev => [data, ...prev]);
      setSelectedClassId(data.id);
      setNewClassName('');
      setIsCreatingClass(false);
    } catch (error) {
      console.error('Error creating class:', error);
      alert('Failed to create class');
    } finally {
      setIsCreatingClassLoading(false);
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!user) {
      alert('You must be logged in to create a blueprint');
      return;
    }

    // Blueprint name is optional - AI will generate during analyze-document if empty
    const finalBlueprintName = formData.blueprintName.trim() || 'Untitled Blueprint';

    // Class selection is optional - selectedClassId can be null for unorganized blueprints
    let finalClassId = selectedClassId;
    let finalClassName = '';

    if (selectedClassId) {
      const selectedClass = classes.find(c => c.id === selectedClassId);
      if (selectedClass) {
        finalClassName = selectedClass.name;
      }
    }

    setLoading(true);

    try {
      // Upload File (if present)
      let fileUrl = null;
      let documentId = null;
      let fileUrls = null;

      if (formData.fileUpload) {
        console.log('[Create] File upload present:', formData.fileUpload.name);
        console.log('[Create] File size:', (formData.fileUpload.size / 1024 / 1024).toFixed(2), 'MB');
        console.log('[Create] Is PDF:', isPdfFile(formData.fileUpload));
        console.log('[Create] Is large:', isLargeFile(formData.fileUpload, 5));

        // For large PDFs, we now use file chunking instead of text extraction
        // This handles scanned PDFs correctly by preserving images for server-side validation
        console.log('[Create] File processing strategy: Chunking for >4MB, Direct for <4MB');

        // Check for duplicate document if we have a class
        if (finalClassId) {
          console.log('Checking for duplicate document...');
          const { data: existingDocs, error: checkError } = await supabase
            .from('class_documents')
            .select('*')
            .eq('class_id', finalClassId)
            .eq('user_id', user.id)
            .eq('name', formData.fileUpload.name)
            .eq('file_size', formData.fileUpload.size);

          if (!checkError && existingDocs && existingDocs.length > 0) {
            // Found duplicate - reuse existing file
            console.log('✅ Duplicate found - reusing existing document');
            const existingDoc = existingDocs[0];
            fileUrl = existingDoc.file_url;
            documentId = existingDoc.id;
            // Try to recover chunks if they exist
            if (existingDoc.metadata && existingDoc.metadata.chunks) {
              fileUrls = existingDoc.metadata.chunks;
            }
          }
        }

        // Only upload if no duplicate was found
        // Only upload if no duplicate was found
        if (!fileUrl) {
          // Changed from 4MB to 5MB as requested
          const MAX_SIZE = 5 * 1024 * 1024;

          if (formData.fileUpload.size > MAX_SIZE) {
            alert('File is too large. Please be under 5 MB.');
            setLoading(false);
            return;
          }

          // Standard small file upload
          const fileExt = formData.fileUpload.name.split('.').pop();
          const fileName = `${user.id}/${finalClassId || 'unorganized'}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('class-documents')
            .upload(fileName, formData.fileUpload);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('class-documents')
            .getPublicUrl(fileName);
          fileUrl = urlData.publicUrl;
        }


        // Save document metadata to class_documents table
        // ALWAYS save the document, even if no class is selected (class_id will be null)
        // This ensures we always have a document_id to link to the blueprint
        if (!documentId) { // Only insert if we didn't find a duplicate earlier
          const { data: newDocData, error: docInsertError } = await supabase
            .from('class_documents')
            .insert([{
              class_id: finalClassId, // Can be null for unorganized blueprints
              user_id: user.id,
              name: formData.fileUpload.name,
              file_path: fileUrl,
              file_url: fileUrl,
              file_size: formData.fileUpload.size,
              file_type: formData.fileUpload.type
            }])
            .select()
            .single();

          if (docInsertError) {
            console.error('[Create] Error saving document metadata:', docInsertError);
            throw docInsertError;
          }

          if (newDocData) {
            documentId = newDocData.id;
            console.log('[Create] ✅ Document saved with ID:', documentId);
          }
        }
      }


      // Create Blueprint
      const content = {
        className: finalClassName,
        professorName: formData.professorName,
        blueprintName: finalBlueprintName,
        textInput: formData.textInput,
        fileUpload: formData.fileUpload ? {
          name: formData.fileUpload.name,
          size: formData.fileUpload.size,
          type: formData.fileUpload.type,
          url: fileUrl,
          file_urls: fileUrls // Store all chunk URLs if available
        } : null,
        mode: mode
      };

      console.log('[Create] Creating blueprint with document_id:', documentId);

      const { data, error } = await supabase
        .from('blueprints')
        .insert([{
          user_id: user.id,
          class_id: finalClassId, // Can be null for unorganized blueprints
          document_id: documentId,
          title: finalBlueprintName,
          description: formData.textInput,
          task_type: mode === 'project' ? 'project' : 'Auto-detect',
          goal_type: 'Auto-detect from document', // Required field
          file_metadata: content.fileUpload,
          content: content
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      console.log('[Create] ✅ Blueprint created successfully:', {
        blueprint_id: data.id,
        document_id: data.document_id,
        title: data.title
      });

      // Navigate to blueprint page - if dev mode enabled, pass query param to trigger automatic pipeline
      navigate(`/blueprint/${data.id}${devModeEnabled ? '?devMode=true' : ''}`);

    } catch (error) {
      console.error('Error creating blueprint:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      alert(`Failed to create blueprint: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const cardBackground = `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23a8a29e' fill-opacity='0.05'%3E%3Ccircle cx='10' cy='10' r='1'/%3E%3C/g%3E%3C/svg%3E")`;

  return (
    <div
      className="min-h-screen bg-transparent pt-24 pb-12 px-4 sm:px-6 relative"
    >
      <div className="max-w-3xl mx-auto relative z-10">

        {/* Header */}
        <div className="text-center mb-10 pt-20">
          <div className="mb-8">
            <h1 className="inline-block text-6xl text-stone-900 dark:text-stone-100 tracking-tight bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm px-8 py-62 rounded-3xl ">
              What are we learning today?
            </h1>
          </div>
          <div className="mb-10">
            <p className="inline-block text-stone-500 dark:text-stone-400 text-lg bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm px-8 py-4 rounded-2xl max-w-2xl mx-auto leading-relaxed">
              Transform PDFs and ideas into structured engineering roadmaps.
            </p>
          </div>
        </div>

        {/* Main Input Card */}
        <div
          className="rounded-2xl shadow-xl border border-stone-300 dark:border-stone-700 overflow-hidden bg-white dark:bg-stone-900"
          style={{ backgroundImage: cardBackground }}
        >

          <div className="p-4 space-y-4">

            <div className="flex gap-4 h-[180px]">

              {/* Left Side: Upload Area (Only in Classwork Mode) */}
              {mode === 'classwork' && (
                <div className="flex-1">
                  {!formData.fileUpload ? (
                    <div
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`h-full border border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging
                        ? 'border-stone-500 bg-stone-50 dark:bg-stone-800'
                        : 'border-stone-300 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800'
                        }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
                      />
                      <div className="p-2 bg-stone-100 dark:bg-stone-800 rounded-lg text-stone-500 dark:text-stone-400 mb-2">
                        <Paperclip className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-medium text-stone-900 dark:text-stone-100">Upload file</p>

                    </div>
                  ) : (
                    <div className={`h-full border rounded-lg p-4 flex flex-col items-center justify-center text-center relative group ${formData.fileUpload.size > 5 * 1024 * 1024
                      ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                      : 'border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800'
                      }`}>
                      <div className={`p-2 border rounded-lg mb-2 shadow-sm ${formData.fileUpload.size > 5 * 1024 * 1024
                        ? 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                        : 'bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700 text-[#FF4A1C]'
                        }`}>
                        {formData.fileUpload.size > 5 * 1024 * 1024 ? (
                          <X className="w-5 h-5" />
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </div>
                      <p className={`text-sm font-medium line-clamp-2 px-2 break-all ${formData.fileUpload.size > 5 * 1024 * 1024
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-stone-900 dark:text-stone-100'
                        }`}>
                        {formData.fileUpload.name}
                      </p>
                      <p className={`text-xs mt-1 ${formData.fileUpload.size > 5 * 1024 * 1024
                        ? 'text-red-500 dark:text-red-400 font-semibold'
                        : 'text-stone-500 dark:text-stone-400'
                        }`}>
                        {formData.fileUpload.size > 5 * 1024 * 1024
                          ? `Too large (${(formData.fileUpload.size / (1024 * 1024)).toFixed(1)} MB)`
                          : `${(formData.fileUpload.size / 1024).toFixed(1)} KB`
                        }
                      </p>
                      {formData.fileUpload.size > 5 * 1024 * 1024 && (
                        <p className="text-[10px] text-red-500 dark:text-red-400 mt-1">
                          Max 5MB allowed
                        </p>
                      )}

                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(); }}
                        className="absolute top-2 right-2 p-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-md text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-900/50 transition-colors opacity-0 group-hover:opacity-100"
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
                  onChange={(e) => setFormData({ ...formData, textInput: e.target.value })}
                  placeholder={
                    formData.fileUpload && formData.fileUpload.size > 5 * 1024 * 1024
                      ? "Share a quick summary of your document instead... "
                      : mode === 'classwork'
                        ? "Or add any specific context, problem details, or questions here..."
                        : "Describe your engineering project idea in detail..."
                  }
                  className={`w-full h-full p-3 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-sm text-stone-900 dark:text-stone-100 resize-none focus:outline-none focus:border-stone-500 dark:focus:border-stone-400 focus:ring-0 leading-relaxed transition-all ${formData.fileUpload && formData.fileUpload.size > 5 * 1024 * 1024
                    ? 'placeholder:text-[#FF4A1C] placeholder:font-medium placeholder:opacity-60'
                    : 'placeholder:text-stone-400 dark:placeholder:text-stone-600'
                    }`}
                />
              </div>

            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-stone-300 dark:border-stone-700">
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('classwork')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${mode === 'classwork'
                    ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-stone-300 dark:border-stone-600'
                    : 'text-stone-500 dark:text-stone-400 border-transparent hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                >
                  <BookOpen className="w-3 h-3" />
                  Classwork
                </button>
                <button
                  onClick={() => setMode('project')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${mode === 'project'
                    ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-stone-300 dark:border-stone-600'
                    : 'text-stone-500 dark:text-stone-400 border-transparent hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
                    }`}
                >
                  <Briefcase className="w-3 h-3" />
                  Project
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Dev Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setDevModeEnabled(!devModeEnabled)}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all border ${devModeEnabled
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={devModeEnabled
                    ? 'Dev Mode ON: Will automatically run full pipeline (analyze → structure → webhooks → search)'
                    : 'Dev Mode OFF: Manual step-by-step control'
                  }
                >
                  {devModeEnabled ? (
                    <>
                      <ToggleRight className="w-4 h-4" />
                      <Zap className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4" />
                      <span className="text-xs">Dev</span>
                    </>
                  )}
                </button>

                {/* Create Blueprint Button */}
                <button
                  onClick={handleSubmit}
                  disabled={loading || (formData.fileUpload && formData.fileUpload.size > 5 * 1024 * 1024)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg font-medium text-sm transition-all shadow-sm ${(loading || (formData.fileUpload && formData.fileUpload.size > 5 * 1024 * 1024))
                    ? 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600 border-stone-200 dark:border-stone-800 cursor-not-allowed'
                    : 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700'
                    }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <span>{devModeEnabled ? 'Create (Dev Mode)' : 'Create Blueprint'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Class Selection Card (Classwork Mode Only) */}
        {mode === 'classwork' && (formData.fileUpload || formData.textInput.trim().length > 0 || selectedClassId || isCreatingClass) && (
          <div className="mt-6 flex gap-6 items-start">
            <div className="rounded-2xl shadow-xl border border-stone-300 dark:border-stone-700 overflow-hidden bg-white dark:bg-stone-900 max-w-[300px] w-full animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="p-5">
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
                  What class is this for?
                </h3>

                <div className="flex flex-col gap-3">
                  {/* Existing Classes */}
                  {classes.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className="group flex items-center gap-3 w-full text-left"
                    >
                      <div className={`
                        w-3 h-3 rounded-full border flex items-center justify-center transition-all flex-shrink-0
                        ${selectedClassId === cls.id
                          ? 'border-[#FF4A1C] bg-[#FF4A1C]'
                          : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 group-hover:border-stone-400 dark:group-hover:border-stone-500'
                        }
                      `}>
                        {/* No inner dot needed if we fill the background */}
                      </div>
                      <span className={`text-sm transition-colors truncate ${selectedClassId === cls.id ? 'text-stone-900 dark:text-stone-100 font-medium' : 'text-stone-600 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-200'
                        }`}>
                        {cls.name}
                      </span>
                    </button>
                  ))}

                  {/* Create New Class UI */}
                  {isCreatingClass ? (
                    <div ref={wrapperRef} className="flex items-center gap-3 pl-[0px] w-full animate-in fade-in slide-in-from-left-2">
                      <div className="w-3 h-3 rounded-full border border-stone-300 dark:border-stone-600 flex-shrink-0 bg-white dark:bg-stone-800" />
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value)}
                          placeholder="Enter Class Name"
                          autoFocus
                          className="bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-600 focus:border-[#FF4A1C] dark:focus:border-[#FF4A1C] focus:ring-0 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-600 dark:placeholder:text-stone-400 placeholder:font-normal w-full px-0 py-1 outline-none transition-all"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateClass();
                            if (e.key === 'Escape') {
                              setIsCreatingClass(false);
                              setNewClassName('');
                            }
                          }}
                        />
                        <button
                          onClick={handleCreateClass}
                          disabled={!newClassName.trim() || isCreatingClassLoading}
                          className="p-1 rounded-full bg-[#FF4A1C] text-white hover:bg-[#e03e15] disabled:opacity-50 transition-colors flex-shrink-0"
                        >
                          {isCreatingClassLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCreatingClass(true);
                        setSelectedClassId(null);
                      }}
                      className="group flex items-center gap-3 w-full text-left mt-1"
                    >
                      <div className="w-3 h-3 rounded-full border border-stone-200 dark:border-stone-700 flex items-center justify-center transition-all flex-shrink-0 bg-white dark:bg-stone-800 group-hover:border-[#FF4A1C]/50">
                      </div>
                      <span className="text-sm text-stone-600 dark:text-stone-400 group-hover:text-[#FF4A1C] transition-colors">
                        Create a Class
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Name This Blueprint (Progressive Disclosure) */}
            {(selectedClassId || isCreatingClass) && (
              <div className="rounded-2xl shadow-xl border border-stone-300 dark:border-stone-700 overflow-hidden bg-white dark:bg-stone-900 flex-1 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="p-5">
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-4">
                    Name This Blueprint
                  </h3>
                  <div className="flex items-center gap-3 pl-[0px] w-full">

                    <input
                      type="text"
                      value={formData.blueprintName}
                      onChange={(e) => setFormData(prev => ({ ...prev, blueprintName: e.target.value }))}
                      placeholder="Enter Blueprint Name"
                      className=" pl-4 bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-600 focus:border-[#FF4A1C] focus:ring-0 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-600 dark:placeholder:text-stone-400 placeholder:font-normal w-full px-0 py-1 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default Create;
