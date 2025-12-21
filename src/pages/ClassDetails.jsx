import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  PenTool, 
  Plus, 
  MoreVertical,
  Loader2,
  FolderOpen,
  Trash2,
  Download,
  Eye
} from 'lucide-react';
import BlueprintModal from '../components/BlueprintModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Sidebar from '../components/Sidebar';
import ClassSidebar from '../components/ClassSidebar';

const ClassDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  
  const [classData, setClassData] = useState(null);
  const [blueprints, setBlueprints] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'blueprints'); // blueprints, documents, help
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: '', itemId: null, itemPath: null });

  useEffect(() => {
    if (user && id) {
      fetchClassDetails();
    }
  }, [user, id]);

  const fetchClassDetails = async () => {
    try {
      // Fetch class details
      const { data: classResult, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .single();

      if (classError) throw classError;
      setClassData(classResult);

      // Fetch blueprints for this class
      const { data: blueprintsResult, error: blueprintsError } = await supabase
        .from('blueprints')
        .select('*')
        .eq('class_id', id)
        .order('created_at', { ascending: false });

      if (blueprintsError) console.error('Error fetching blueprints:', blueprintsError);
      if (blueprintsResult) setBlueprints(blueprintsResult);

      // Fetch documents for this class
      const { data: documentsResult, error: documentsError } = await supabase
        .from('class_documents')
        .select('*')
        .eq('class_id', id)
        .order('created_at', { ascending: false });

      if (documentsError) console.error('Error fetching documents:', documentsError);
      if (documentsResult) setDocuments(documentsResult);

    } catch (error) {
      console.error('Error fetching class details:', error);
      // Navigate back to dashboard on error or if class not found
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploadingDocument(true);

    try {
      // Check for duplicate document in this class (by filename and size)
      console.log('Checking for duplicate document...');
      const { data: existingDocs, error: checkError } = await supabase
        .from('class_documents')
        .select('*')
        .eq('class_id', id)
        .eq('user_id', user.id)
        .eq('name', file.name)
        .eq('file_size', file.size);

      if (checkError) {
        console.error('Error checking for duplicates:', checkError);
      } else if (existingDocs && existingDocs.length > 0) {
        // Found duplicate - show custom confirmation dialog
        alert(
          `⚠️ A document with the same name and size already exists in this class:\n\n` +
          `"${file.name}" (${(file.size / 1024).toFixed(1)} KB)\n\n` +
          `The upload will continue with a new version.`
        );
        // Continue with upload
      }

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${id}/${Date.now()}.${fileExt}`;
      
      console.log('Attempting to upload file:', fileName);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('class-documents')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        
        // Check for specific errors
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
          alert('⚠️ Storage bucket not set up!\n\nPlease create the "class-documents" bucket in Supabase:\n1. Go to Storage in Supabase Dashboard\n2. Create new bucket named "class-documents"\n3. Set it to Public\n4. Add storage policies (see STORAGE_SETUP.md)');
          return;
        }
        
        throw uploadError;
      }

      console.log('File uploaded successfully, getting public URL...');
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('class-documents')
        .getPublicUrl(fileName);

      console.log('Saving metadata to database...');

      // Save document metadata to database
      const { data: docData, error: docError } = await supabase
        .from('class_documents')
        .insert([{
          class_id: id,
          user_id: user.id,
          name: file.name,
          file_path: fileName,
          file_url: urlData.publicUrl,
          file_size: file.size,
          file_type: file.type
        }])
        .select()
        .single();

      if (docError) {
        console.error('Database error:', docError);
        
        // Check for specific database errors
        if (docError.message?.includes('relation') && docError.message?.includes('does not exist')) {
          alert('⚠️ Database table not set up!\n\nPlease run the SQL migration:\n1. Go to SQL Editor in Supabase Dashboard\n2. Run the file: create_class_documents_table.sql\n\nNote: The file was uploaded to storage but metadata wasn\'t saved.');
          return;
        }
        
        if (docError.code === '42501' || docError.message?.includes('policy')) {
          alert('⚠️ Database permissions issue!\n\nPlease check that RLS policies are set up for the class_documents table.\n\nNote: The file was uploaded to storage but metadata wasn\'t saved.');
          return;
        }
        
        throw docError;
      }

      console.log('Document uploaded successfully!');

      // Add to documents list
      setDocuments([docData, ...documents]);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      alert('✅ Document uploaded successfully!');
    } catch (error) {
      console.error('Error uploading document:', error);
      alert(`❌ Failed to upload document.\n\nError: ${error.message}\n\nCheck the browser console for more details.`);
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (e, documentId, filePath) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      type: 'document',
      itemId: documentId,
      itemPath: filePath
    });
  };

  const confirmDelete = async () => {
    const { type, itemId, itemPath } = confirmDialog;
    
    try {
      if (type === 'document') {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('class-documents')
          .remove([itemPath]);

        if (storageError) console.error('Storage delete error:', storageError);

        // Delete from database
        const { error: dbError } = await supabase
          .from('class_documents')
          .delete()
          .eq('id', itemId);

        if (dbError) throw dbError;

        setDocuments(documents.filter(doc => doc.id !== itemId));
        setOpenDropdownId(null);
      } else if (type === 'blueprint') {
        const { error } = await supabase
          .from('blueprints')
          .delete()
          .eq('id', itemId);

        if (error) throw error;

        setBlueprints(blueprints.filter(bp => bp.id !== itemId));
        setOpenDropdownId(null);
      }
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      alert(`Failed to delete ${type}`);
    }
  };

  const handleDeleteBlueprint = async (e, blueprintId) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      type: 'blueprint',
      itemId: blueprintId,
      itemPath: null
    });
  };

  const toggleDropdown = (e, blueprintId) => {
    e.stopPropagation();
    setOpenDropdownId(openDropdownId === blueprintId ? null : blueprintId);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4A1C]" />
      </div>
    );
  }

  if (!classData) return null;

  return (
    <div 
      className="min-h-screen bg-transparent flex text-outline relative"
    >
      
      {/* Global Sidebar - Collapsed */}
      <div className="fixed top-20 left-0 h-[calc(100vh-80px)] z-30 hidden lg:block w-20">
        <Sidebar collapsed={true} />
      </div>

      {/* Class Sidebar */}
      <div className="fixed top-20 left-20 h-[calc(100vh-80px)] z-20 hidden lg:block w-56 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800">
        <ClassSidebar />
      </div>

      <div className="flex-1 min-w-0 lg:ml-64 relative z-10">
        {isBlueprintModalOpen && (
          <BlueprintModal 
            isOpen={isBlueprintModalOpen}
            onClose={() => setIsBlueprintModalOpen(false)}
            classId={id}
            className={classData.name}
            professorName={classData.professor}
          />
        )}
        
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog({ isOpen: false, type: '', itemId: null, itemPath: null })}
          onConfirm={confirmDelete}
          title="Are you sure?"
          message={`Are you sure you want to delete this ${confirmDialog.type}? This action cannot be undone.`}
          confirmText="Yes"
          cancelText="No"
          type="danger"
        />
        
        <div className="pt-8 pb-12 px-6 lg:px-12 max-w-7xl mx-auto space-y-12">

          {/* Header */}
          <div className="flex flex-col gap-6 mb-8">
             <div className="text-left">
                <h1 className="text-4xl font-normal text-[#2A2B2A] dark:text-stone-100 tracking-tight">{classData.name}</h1>
                <p className="text-stone-500 dark:text-stone-400 text-lg">{classData.professor}</p>
             </div>

             {/* Navigation Toggle */}
             <div className="self-center bg-stone-100/50 dark:bg-stone-800/50 p-1 rounded-lg inline-flex items-center">
                <button 
                  onClick={() => setActiveTab('blueprints')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'blueprints' 
                      ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' 
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  Blueprints
                </button>
                <button 
                  onClick={() => setActiveTab('documents')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'documents' 
                      ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' 
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  Documents
                </button>
             </div>
          </div>
  
          {/* Content Area */}
          <div className="min-h-[400px]">
            {activeTab === 'documents' && (
              <div className="min-h-[300px]">
                {documents.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-normal text-stone-900 dark:text-stone-100">Your Documents</h3>
                      <div>
                        <input 
                          ref={fileInputRef}
                          type="file" 
                          onChange={handleDocumentUpload}
                          accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
                          className="hidden"
                          id="document-upload"
                        />
                        <label 
                          htmlFor="document-upload"
                          className={`flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-all text-[#2A2B2A] dark:text-stone-100 cursor-pointer ${uploadingDocument ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {uploadingDocument ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span className="font-medium text-sm">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-5 h-5" />
                              <span className="font-medium text-sm">Upload Document</span>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {documents.map((doc) => (
                        <div 
                          key={doc.id}
                          className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all group relative flex flex-col h-full"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-lg flex items-center justify-center text-stone-500 dark:text-stone-400">
                              <FileText className="w-5 h-5" />
                            </div>
                            
                            <div className="relative">
                              <button
                                onClick={(e) => toggleDropdown(e, doc.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>
                              
                              {openDropdownId === doc.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-stone-900 rounded-xl shadow-xl border border-stone-100 dark:border-stone-800 py-1 z-10 animate-fade-in">
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full px-4 py-2 text-left text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Eye className="w-4 h-4" />
                                    View
                                  </a>
                                  <a
                                    href={doc.file_url}
                                    download
                                    className="w-full px-4 py-2 text-left text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center gap-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Download className="w-4 h-4" />
                                    Download
                                  </a>
                                  <button
                                    onClick={(e) => handleDeleteDocument(e, doc.id, doc.file_path)}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="mb-6">
                            <h4 className="text-xl font-normal text-stone-900 dark:text-stone-100 mb-1 truncate" title={doc.name}>
                              {doc.name}
                            </h4>
                            <p className="text-sm text-stone-500 dark:text-stone-400">
                              {(doc.file_size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          
                          <div className="mt-auto pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-400 dark:text-stone-500">
                            <div className="flex items-center gap-1.5">
                              <span>Created</span>
                              <span className="text-stone-500 dark:text-stone-400">{new Date(doc.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                               <span>{new Date(doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-6 text-stone-300 dark:text-stone-600">
                      <FolderOpen className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-[#2A2B2A] dark:text-stone-100 mb-2">Class Documents</h3>
                    <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-md mx-auto">
                      Store your syllabus, assignments, and lecture notes here to keep everything organized.
                    </p>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      onChange={handleDocumentUpload}
                      accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
                      className="hidden"
                      id="document-upload-empty"
                    />
                    <label 
                      htmlFor="document-upload-empty"
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-all text-[#2A2B2A] dark:text-stone-100 cursor-pointer ${uploadingDocument ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {uploadingDocument ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="font-medium text-sm">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5" />
                          <span className="font-medium text-sm">Upload Document</span>
                        </>
                      )}
                    </label>
                  </div>
                )}
              </div>
            )}
  
            {activeTab === 'blueprints' && (
              <div className="min-h-[300px]">
                {blueprints.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-normal text-stone-900 dark:text-stone-100">Your Blueprints</h3>
                      <button 
                        onClick={() => setIsBlueprintModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-all text-[#2A2B2A] dark:text-stone-100"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium text-sm">New Blueprint</span>
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {blueprints.map((blueprint) => (
                        <div 
                          key={blueprint.id}
                          onClick={() => navigate(`/blueprint/${blueprint.id}`)}
                          className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 shadow-sm hover:shadow-md cursor-pointer transition-all group relative flex flex-col h-full"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-lg flex items-center justify-center text-stone-500 dark:text-stone-400">
                              <PenTool className="w-5 h-5" />
                            </div>
                            
                            <div className="relative">
                              <button
                                onClick={(e) => toggleDropdown(e, blueprint.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>
                              
                              {openDropdownId === blueprint.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-stone-900 rounded-xl shadow-xl border border-stone-100 dark:border-stone-800 py-1 z-10 animate-fade-in">
                                  <button
                                    onClick={(e) => handleDeleteBlueprint(e, blueprint.id)}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Blueprint
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="mb-6">
                            <h4 className="text-xl font-normal text-stone-900 dark:text-stone-100 mb-1 truncate" title={blueprint.title || blueprint.content?.blueprintName || 'Untitled Blueprint'}>
                              {blueprint.title || blueprint.content?.blueprintName || 'Untitled Blueprint'}
                            </h4>
                            <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 h-10">
                              {blueprint.task_type}
                            </p>
                          </div>
                          
                          <div className="mt-auto pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-400 dark:text-stone-500">
                             <div className="flex items-center gap-1.5">
                              <span>Created</span>
                              <span className="text-stone-500 dark:text-stone-400">{new Date(blueprint.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                               <span>{new Date(blueprint.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-6 text-stone-300 dark:text-stone-600">
                      <PenTool className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-[#2A2B2A] dark:text-stone-100 mb-2">Class Blueprints</h3>
                    <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-md mx-auto">
                      Create and manage your engineering blueprints and diagrams for this class.
                    </p>
                    <button 
                      onClick={() => setIsBlueprintModalOpen(true)}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-all text-[#2A2B2A] dark:text-stone-100"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="font-medium text-sm">New Blueprint</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassDetails;

