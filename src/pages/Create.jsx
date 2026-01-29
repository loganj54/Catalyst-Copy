import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Upload, FileText, Trash2, Sparkles, BookOpen,
  ArrowRight, Layers, Command, Loader2, Paperclip, Plus, Check, X,
  ToggleLeft, ToggleRight, Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { extractTextFromPdf, isPdfFile, isLargeFile } from '../utils/pdfExtractor';

const Create = () => {
  const { user } = useAuth();
  const { bgPattern } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  // State

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

  const confirmNewClassLocal = () => {
    if (!newClassName.trim()) {
      setIsCreatingClass(false);
      return;
    }

    const tempId = 'TEMP_NEW_CLASS';
    const tempClass = {
      id: tempId,
      name: newClassName.trim(),
      isTemp: true
    };

    // Remove any existing temp class and add the new one
    setClasses(prev => [tempClass, ...prev.filter(c => c.id !== tempId)]);
    setSelectedClassId(tempId);
    setNewClassName('');
    setIsCreatingClass(false);
  };

  const cancelNewClass = () => {
    setIsCreatingClass(false);
    setNewClassName('');
  };

  // Handle clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        if (isCreatingClass) {
          if (newClassName.trim()) {
            confirmNewClassLocal();
          } else {
            cancelNewClass();
          }
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef, isCreatingClass, newClassName]);



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
    if (user) {
      fetchClasses();
    }
  }, [user]);

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

  // No longer used directly, but kept as reference or removed
  // We use confirmNewClassLocal now


  // Submit Handler
  const handleSubmit = async () => {
    if (!user) {
      alert('You must be logged in to create a blueprint');
      return;
    }

    // Blueprint name is optional - AI will generate during analyze-document if empty
    const finalBlueprintName = formData.blueprintName.trim() || 'Untitled Blueprint';

    // Class selection logic
    let finalClassId = selectedClassId;
    let finalClassName = '';

    if (selectedClassId) {
      const selectedClass = classes.find(c => c.id === selectedClassId);

      // Handle Temporary Class Creation
      if (selectedClass && selectedClass.isTemp) {
        try {
          // Now we actually create the class
          const { data: newClassData, error: createClassError } = await supabase
            .from('classes')
            .insert([{
              user_id: user.id,
              name: selectedClass.name,
              professor: null
            }])
            .select()
            .single();

          if (createClassError) throw createClassError;

          finalClassId = newClassData.id;
          finalClassName = newClassData.name;

        } catch (err) {
          console.error('Error creating deferred class:', err);
          alert('Failed to create the new class. Please try again.');
          return;
        }
      } else if (selectedClass) {
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
        } : null
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
          task_type: 'Auto-detect',
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

  // const cardBackground = ... (Removed per new design spec)

  return (
    <div
      className="min-h-[calc(100vh-5rem)] w-full flex flex-col items-center pt-[max(2rem,calc(50vh-20.5rem))] p-6 relative transition-all duration-300"
    >
      <div className="w-full max-w-3xl relative z-10 space-y-8">

        {/* Header */}
        <div className="text-center">
          <div className="mb-8">
            <h1 className="inline-block text-6xl text-black tracking-tight font-display mb-2">
              What are we learning today?
            </h1>
          </div>
          <div className="mb-4">
            <p className="inline-block text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
              Turn homework, notes, or ideas into a clear learning blueprint
            </p>
          </div>
        </div>

        {/* Main Input Card */}
        <div
          className="rounded-2xl shadow-xl border border-gray-300 bg-white overflow-hidden"
        // style removed
        >

          <div className="p-4 space-y-4">

            <div className="flex gap-4 h-[180px]">

              {/* Left Side: Upload Area */}
              <div className="flex-1">
                {!formData.fileUpload ? (
                  <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`h-full border border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging
                      ? 'border-gray-500 bg-gray-50'
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
                    />
                    <div className="p-2 bg-gray-100 rounded-lg text-gray-400 mb-2">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-gray-900">Upload file</p>

                  </div>
                ) : (
                  <div className={`h-full border rounded-lg p-4 flex flex-col items-center justify-center text-center relative group ${formData.fileUpload.size > 5 * 1024 * 1024
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 bg-white'
                    }`}>
                    <div className={`p-2 border rounded-lg mb-2 shadow-sm ${formData.fileUpload.size > 5 * 1024 * 1024
                      ? 'bg-red-100 border-red-200 text-red-600'
                      : 'bg-white border-gray-200 text-gray-900'
                      }`}>
                      {formData.fileUpload.size > 5 * 1024 * 1024 ? (
                        <X className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>
                    <p className={`text-sm font-medium line-clamp-2 px-2 break-all ${formData.fileUpload.size > 5 * 1024 * 1024
                      ? 'text-red-700'
                      : 'text-gray-900'
                      }`}>
                      {formData.fileUpload.name}
                    </p>
                    <p className={`text-xs mt-1 ${formData.fileUpload.size > 5 * 1024 * 1024
                      ? 'text-red-500 font-semibold'
                      : 'text-gray-500'
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
                      className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded-md text-gray-400 hover:text-red-600 hover:border-red-300 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right Side: Text Input */}
              <div className="flex-1">
                <textarea
                  value={formData.textInput}
                  onChange={(e) => setFormData({ ...formData, textInput: e.target.value })}
                  placeholder={
                    formData.fileUpload && formData.fileUpload.size > 5 * 1024 * 1024
                      ? "Share a quick summary of your document instead... "
                      : "Or add any specific context, problem details, or questions here..."
                  }
                  className={`w-full h-full p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 resize-none focus:outline-none focus:border-gray-400 focus:ring-0 leading-relaxed transition-all ${formData.fileUpload && formData.fileUpload.size > 5 * 1024 * 1024
                    ? 'placeholder:text-red-400 placeholder:font-medium placeholder:opacity-60'
                    : 'placeholder:text-gray-400'
                    }`}
                />
              </div>

            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex gap-2">
                {/* Static Classwork Button (decorative only) */}
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg font-medium text-sm transition-all shadow-sm bg-white text-gray-700 border-gray-200 cursor-default"
                >
                  <BookOpen className="w-4 h-4" />
                  Classwork
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Dev Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setDevModeEnabled(!devModeEnabled)}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all border ${devModeEnabled
                    ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
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
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-black text-white border-transparent hover:bg-gray-800'
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
        {(formData.fileUpload || formData.textInput.trim().length > 0 || selectedClassId || isCreatingClass) && (
          <div className="mt-6 flex gap-6 items-start">
            <div className="rounded-2xl shadow-xl border border-gray-300 overflow-hidden bg-white max-w-[300px] w-full animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
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
                          ? 'border-black bg-black'
                          : 'border-gray-300 bg-white group-hover:border-gray-400'
                        }
                      `}>
                        {/* No inner dot needed if we fill the background */}
                      </div>
                      <span className={`text-sm transition-colors truncate ${selectedClassId === cls.id ? 'text-gray-900 font-medium' : 'text-gray-600 group-hover:text-gray-900'
                        }`}>
                        {cls.name}
                      </span>
                    </button>
                  ))}

                  {isCreatingClass ? (
                    <div ref={wrapperRef} className="flex items-center gap-3 pl-[0px] w-full animate-in fade-in slide-in-from-left-2">
                      <div className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0 bg-white" />
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value)}
                          placeholder="Enter Class Name"
                          autoFocus
                          className="w-full p-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-500 focus:ring-0 transition-all"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmNewClassLocal();
                            if (e.key === 'Escape') cancelNewClass();
                          }}
                        />
                        <button
                          onClick={cancelNewClass}
                          className="p-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
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
                      <div className="w-3 h-3 rounded-full border border-gray-200 flex items-center justify-center transition-all flex-shrink-0 bg-white group-hover:border-black/50">
                      </div>
                      <span className="text-sm text-gray-600 group-hover:text-black transition-colors">
                        Create a Class
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Name This Blueprint (Progressive Disclosure) */}
            {(selectedClassId || isCreatingClass) && (
              <div className="rounded-2xl shadow-xl border border-gray-300 overflow-hidden bg-white flex-1 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">
                    Name This Blueprint
                  </h3>
                  <div className="flex items-center gap-3 pl-[0px] w-full">

                    <input
                      type="text"
                      value={formData.blueprintName}
                      onChange={(e) => setFormData(prev => ({ ...prev, blueprintName: e.target.value }))}
                      placeholder="Enter Blueprint Name"
                      className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-gray-500 focus:ring-0 transition-all"
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
