import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const BlueprintModal = ({ isOpen, onClose, classId = null, className = '', professorName = '' }) => {
  if (!isOpen) return null;

  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    className: className,
    professorName: professorName,
    blueprintName: '',
    textInput: '',
    fileUpload: null
  });
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [existingDocuments, setExistingDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Fetch existing documents when modal opens and classId is provided
  useEffect(() => {
    if (isOpen && classId && user) {
      fetchClassDocuments();
    }
  }, [isOpen, classId, user]);

  const fetchClassDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const { data, error } = await supabase
        .from('class_documents')
        .select('*')
        .eq('class_id', classId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const docs = data || [];
      setExistingDocuments(docs);
    } catch (error) {
      console.error('Error fetching class documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

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
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setUploadedFile(file);
      setFormData(prev => ({...prev, fileUpload: file}));
      setSelectedDocument(null); // Clear any selected existing document
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    handleFileSelection(file);
  };


  const removeFile = () => {
    setUploadedFile(null);
    setFormData(prev => ({...prev, fileUpload: null}));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectDocument = (doc) => {
    setSelectedDocument(doc);
    // Create a virtual file object from the existing document
    setFormData(prev => ({...prev, fileUpload: {
      name: doc.name,
      size: doc.file_size,
      type: doc.file_type,
      url: doc.file_url,
      isExisting: true
    }}));
    setUploadedFile(null); // Clear any uploaded file
  };

  const removeSelectedDocument = () => {
    setSelectedDocument(null);
    setFormData(prev => ({...prev, fileUpload: null}));
  };

  const handleSubmit = async () => {
    if (!user) {
      alert('You must be logged in to create a blueprint');
      return;
    }

    // Validation
    if (!formData.blueprintName.trim()) {
      alert('Please enter a blueprint name');
      return;
    }

    // If no classId provided (creating from homepage/classes page), require class name
    if (!classId && !formData.className.trim()) {
      alert('Please enter a class name');
      return;
    }

    setLoading(true);

    try {
      let finalClassId = classId;

      // If no classId provided, create a new class first
      if (!classId && formData.className.trim()) {
        const { data: newClass, error: classError } = await supabase
          .from('classes')
          .insert([{
            user_id: user.id,
            name: formData.className.trim(),
            professor: formData.professorName.trim() || null
          }])
          .select()
          .single();

        if (classError) throw classError;
        finalClassId = newClass.id;
      }

      // Task type will be inferred by AI during document analysis
      // User can optionally provide context in the text input field

      // Upload file to Supabase Storage if present (only if it's a new upload, not existing document)
      let fileUrl = null;
      let documentId = null; // Track the class_document ID for linking
      
      if (formData.fileUpload) {
        // Check if this is an existing document (already has a URL)
        if (formData.fileUpload.isExisting) {
          // Use the existing document's URL and ID
          fileUrl = formData.fileUpload.url;
          // If we have a selectedDocument, use its ID
          if (selectedDocument) {
            documentId = selectedDocument.id;
            console.log('Using existing document ID:', documentId);
          }
        } else {
          // Check for duplicate document in this class (by filename and size)
          console.log('Checking for duplicate document...');
          const { data: existingDocs, error: checkError } = await supabase
            .from('class_documents')
            .select('*')
            .eq('class_id', finalClassId)
            .eq('user_id', user.id)
            .eq('name', formData.fileUpload.name)
            .eq('file_size', formData.fileUpload.size);

          if (checkError) {
            console.error('Error checking for duplicates:', checkError);
          } else if (existingDocs && existingDocs.length > 0) {
            // Found duplicate - use existing file instead of uploading again
            console.log('✅ Duplicate found - reusing existing document');
            const existingDoc = existingDocs[0];
            fileUrl = existingDoc.file_url;
            documentId = existingDoc.id; // Get the document ID for linking
            console.log('Reusing existing document ID:', documentId);
            
            alert(
              `ℹ️ This document already exists in the class!\n\n` +
              `"${formData.fileUpload.name}"\n\n` +
              `We'll reuse the existing file instead of uploading a duplicate.`
            );
          }

          // Only upload if no duplicate was found
          if (!fileUrl) {
            // Upload new file to CLASS documents bucket
            const fileExt = formData.fileUpload.name.split('.').pop();
            // Use finalClassId in the path
            const fileName = `${user.id}/${finalClassId}/${Date.now()}.${fileExt}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('class-documents')
              .upload(fileName, formData.fileUpload);

            if (uploadError) {
              console.error('File upload error:', uploadError);
              // Continue anyway, don't fail the whole blueprint creation? 
              // Maybe alert user but let blueprint proceed without file?
            } else {
              // Get public URL
              const { data: urlData } = supabase.storage
                .from('class-documents')
                .getPublicUrl(fileName);
              fileUrl = urlData.publicUrl;

              // ALSO save to class_documents table so it appears in the class page
              const { data: newDocData, error: docError } = await supabase
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
                
              if (docError) {
                console.error('Error saving document metadata:', docError);
                // We don't stop the blueprint creation if this fails, but it's good to log
              } else if (newDocData) {
                documentId = newDocData.id;
                console.log('Created new document with ID:', documentId);
              }
            }
          }
        }
      }

      // Prepare content object to store additional data
      const content = {
        className: formData.className,
        professorName: formData.professorName,
        blueprintName: formData.blueprintName,
        textInput: formData.textInput,
        fileUpload: formData.fileUpload ? {
          name: formData.fileUpload.name,
          size: formData.fileUpload.size,
          type: formData.fileUpload.type,
          url: fileUrl
        } : null,
        timestamp: new Date().toISOString()
      };

      // Insert into blueprints table with the class_id and document_id
      // Task type and goal will be inferred by AI during document analysis
      const { data, error } = await supabase
        .from('blueprints')
        .insert([{
          user_id: user.id,
          class_id: finalClassId,
          document_id: documentId, // Link to the class_document for analysis reuse
          title: formData.blueprintName,
          description: formData.textInput,
          task_type: 'Auto-detect from document', // AI will infer the actual task type
          goal_type: 'Auto-detect from document', // AI will infer the goal
          file_metadata: formData.fileUpload ? {
            name: formData.fileUpload.name,
            size: formData.fileUpload.size,
            type: formData.fileUpload.type,
            url: fileUrl
          } : null,
          content: content // Keep content for future AI plan, or remove if fully migrated
        }])
        .select()
        .single();

      if (error) throw error;

      // Close modal and navigate to the blueprint page
      onClose();
      navigate(`/blueprint/${data.id}`);
    } catch (error) {
      console.error('Error creating blueprint:', error);
      alert('Failed to create blueprint. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
        <div className="sticky top-0 right-0 p-4 flex justify-end bg-white/80 backdrop-blur-md z-10">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-500" />
          </button>
        </div>

        <div className="px-8 pb-8 space-y-6">
          <h2 className="text-2xl font-bold text-[#2A2B2A] mb-6">Create a New Blueprint</h2>

          {/* Top Row - Only show if classId is NOT provided */}
          {!classId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-600">Class name?</label>
                <input 
                  type="text" 
                  value={formData.className}
                  onChange={(e) => setFormData({...formData, className: e.target.value})}
                  className="w-full p-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/20 focus:border-[#FF4A1C] transition-all"
                  placeholder="e.g. Calculus I"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-600">Professor name?</label>
                <input 
                  type="text" 
                  value={formData.professorName}
                  onChange={(e) => setFormData({...formData, professorName: e.target.value})}
                  className="w-full p-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/20 focus:border-[#FF4A1C] transition-all"
                  placeholder="e.g. Dr. Smith"
                />
              </div>
            </div>
          )}

          {/* Blueprint Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-600">Name this Blueprint?</label>
            <input 
              type="text" 
              value={formData.blueprintName}
              onChange={(e) => setFormData({...formData, blueprintName: e.target.value})}
              className="w-full p-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/20 focus:border-[#FF4A1C] transition-all"
              placeholder="e.g. Midterm Prep"
            />
          </div>

          {/* Document Upload Section */}
          <div className="space-y-4 pt-4 border-t border-stone-100">
            <label className="block text-center text-sm font-medium text-stone-600">Show me what you're looking at.</label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* File Upload or Select Container */}
              <div 
                className="relative h-full min-h-[160px] flex flex-col"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {/* Drag Overlay */}
                {isDragging && (
                  <div className="absolute inset-0 z-20 bg-[#FF4A1C]/10 border-2 border-[#FF4A1C] border-dashed rounded-xl flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in pointer-events-none">
                     <Upload className="w-10 h-10 text-[#FF4A1C] mb-2" />
                     <p className="font-bold text-[#FF4A1C]">Drop to upload</p>
                  </div>
                )}

                {/* Hidden File Input */}
                <input 
                  ref={fileInputRef}
                  type="file" 
                  onChange={handleFileUpload}
                  accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
                  className="hidden"
                  id="file-upload"
                />

                {/* Content Area */}
                <div className={`flex-1 flex flex-col border-2 rounded-xl transition-all h-full ${
                  (uploadedFile || selectedDocument) ? 'border-[#FF4A1C] bg-[#FF4A1C]/5' : 
                  'border-stone-300 bg-white'
                }`}>
                  
                  {/* Case 1: File Selected (Uploaded or Existing) */}
                  {(uploadedFile || selectedDocument) ? (
                    <div className="p-4 flex flex-col h-full justify-center">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <FileText className="w-6 h-6 text-[#FF4A1C]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#2A2B2A] truncate max-w-[140px]">
                              {uploadedFile?.name || selectedDocument?.name}
                            </p>
                            <p className="text-xs text-stone-500">
                              {((uploadedFile?.size || selectedDocument?.file_size) / 1024).toFixed(1)} KB
                            </p>
                            {selectedDocument && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 bg-white text-[10px] font-medium text-[#FF4A1C] rounded border border-[#FF4A1C]/20">
                                Existing Document
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={uploadedFile ? removeFile : removeSelectedDocument}
                          className="p-1.5 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-stone-500 mt-2 text-center">
                        File ready to be analyzed
                      </p>
                    </div>
                  ) : (
                    /* Case 2: No File Selected */
                    <div className="flex flex-col h-full relative">
                      {/* Internal Header / Toggle */}
                      {existingDocuments.length > 0 && (
                        <div className="flex items-center justify-between p-3 border-b border-stone-100 bg-stone-50/50 rounded-t-xl sticky top-0 backdrop-blur-sm z-10">
                          <span className="text-xs font-bold text-stone-500 uppercase tracking-wide">
                            Select Document
                          </span>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs font-medium text-[#FF4A1C] hover:text-[#e03e15] hover:bg-[#FF4A1C]/5 px-2 py-1 rounded transition-colors flex items-center gap-1"
                          >
                            <Upload className="w-3 h-3" />
                            Upload New
                          </button>
                        </div>
                      )}

                      {/* Main View */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {existingDocuments.length > 0 ? (
                          /* List View */
                          <div className="p-2 space-y-1">
                            {existingDocuments.map((doc) => (
                              <div
                                key={doc.id}
                                onClick={() => handleSelectDocument(doc)}
                                className="group flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-[#FF4A1C]/20 hover:bg-[#FF4A1C]/5 cursor-pointer transition-all"
                              >
                                <div className="p-1.5 bg-stone-100 group-hover:bg-white rounded text-stone-400 group-hover:text-[#FF4A1C] transition-colors">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[#2A2B2A] truncate">
                                    {doc.name}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-stone-400">
                                    <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                                    <span>•</span>
                                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          /* Upload View (Default when no docs) */
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="h-full flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-stone-50 transition-colors"
                          >
                            <div className="p-3 bg-stone-100 rounded-full mb-3 group-hover:scale-110 transition-transform">
                              <Upload className="w-6 h-6 text-stone-400" />
                            </div>
                            <p className="text-sm font-medium text-[#2A2B2A] mb-1">
                              Click or drag file
                            </p>
                            <p className="text-xs text-stone-500">
                              PDF, IMG, TXT, DOC (Max 10MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Text Input - Optional context */}
              <textarea 
                value={formData.textInput}
                onChange={(e) => setFormData({...formData, textInput: e.target.value})}
                className="w-full h-full min-h-[160px] p-3 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/20 focus:border-[#FF4A1C] transition-all resize-none text-sm"
                placeholder="Optional: Paste problem text, add notes, or describe what you're trying to learn..."
              />
            </div>
          </div>

          {/* Goal Dropdown */}
          

          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 bg-[#FF4A1C] hover:bg-black text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate Blueprint'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlueprintModal;

