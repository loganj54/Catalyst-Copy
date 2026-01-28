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
  Eye,
  Edit2
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { useTheme } from '../context/ThemeContext';
import { Sidebar } from '../components/dub-ui/Sidebar';

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
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: '', itemId: null, itemPath: null });
  const [editingBlueprint, setEditingBlueprint] = useState(null);
  const [newBlueprintName, setNewBlueprintName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

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

  const handleViewDocument = async (e, doc) => {
    e.stopPropagation();

    try {
      let viewUrl = doc.file_url;

      // If public URL is not available or might be broken, try generating a signed URL
      if (!viewUrl || viewUrl.includes('error')) {
        console.log('Public URL not available, generating signed URL...');
        const { data, error } = await supabase.storage
          .from('class-documents')
          .createSignedUrl(doc.file_path, 3600); // 1 hour expiry

        if (error) {
          console.error('Error generating signed URL:', error);
          alert('❌ Failed to open document.\n\nPlease check that storage policies are configured correctly.');
          return;
        }
        viewUrl = data.signedUrl;
      }

      // Open document in new tab
      window.open(viewUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('❌ Failed to open document.\n\nError: ' + error.message);
    }
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

  const handleEditBlueprint = (e, blueprint) => {
    e.stopPropagation();
    setEditingBlueprint(blueprint);
    setNewBlueprintName(blueprint.title || blueprint.content?.blueprintName || 'Untitled Blueprint');
    setOpenDropdownId(null);
  };

  const saveBlueprintName = async () => {
    if (!editingBlueprint || !newBlueprintName.trim()) return;

    setIsSavingName(true);
    try {
      // Update both title column and content.blueprintName for consistency
      const updatedContent = {
        ...editingBlueprint.content,
        blueprintName: newBlueprintName.trim()
      };

      const { error } = await supabase
        .from('blueprints')
        .update({
          title: newBlueprintName.trim(),
          content: updatedContent
        })
        .eq('id', editingBlueprint.id);

      if (error) throw error;

      // Update local state
      setBlueprints(blueprints.map(bp =>
        bp.id === editingBlueprint.id
          ? { ...bp, title: newBlueprintName.trim(), content: updatedContent }
          : bp
      ));

      setEditingBlueprint(null);
      setNewBlueprintName('');
    } catch (error) {
      console.error('Error updating blueprint name:', error);
      alert('Failed to update blueprint name');
    } finally {
      setIsSavingName(false);
    }
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
      <div className="min-h-screen bg-white dark:bg-stone-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4A1C]" />
      </div>
    );
  }

  if (!classData) return null;

  const { bgPattern } = useTheme(); // Import theme

  return (
    <div className="flex h-full w-full bg-stone-100 dark:bg-stone-950 py-3 pr-3 pl-0 gap-0 overflow-hidden transition-colors duration-300">

      {/* 1. Class Sidebar Bubble */}
      <div className="hidden lg:flex flex-col w-[250px] bg-white border-l border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl ring-1 ring-black/5 overflow-hidden">
        <Sidebar className="w-full h-full border-r-0 bg-white" activeClassId={id} />
      </div>

      {/* 2. Main Content Bubble */}
      <div className={`flex-1 flex flex-col min-w-0 ml-3 rounded-2xl shadow-xl ring-1 ring-black/5 overflow-hidden transition-all duration-300 relative bg-white dark:bg-stone-950`}>

        {/* Background Layer: Grid + Mask (Only visible if pattern is 'grid') */}
        {bgPattern === 'grid' && (
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808025_1px,transparent_1px),linear-gradient(to_bottom,#80808025_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff25_1px,transparent_1px),linear-gradient(to_bottom,#ffffff25_1px,transparent_1px)]"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white dark:from-stone-900 dark:via-transparent dark:to-stone-900"></div>
          </div>
        )}

        {/* Background Layer: Dots (Only visible if pattern is 'dots') */}
        {bgPattern === 'dots' && (
          <div className="absolute inset-0 pointer-events-none z-0 bg-pattern-dots opacity-100"></div>
        )}

        {/* Modals & Dialogs (ensure z-index or place outside if needed, usually fixed works) */}
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

        {editingBlueprint && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Rename Blueprint</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Blueprint Name
                  </label>
                  <input
                    type="text"
                    value={newBlueprintName}
                    onChange={(e) => setNewBlueprintName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all text-gray-900"
                    placeholder="Enter new name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveBlueprintName();
                      if (e.key === 'Escape') setEditingBlueprint(null);
                    }}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setEditingBlueprint(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveBlueprintName}
                    disabled={isSavingName || !newBlueprintName.trim()}
                    className="px-4 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isSavingName ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header Area */}
        <header className="px-6 py-5 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex-shrink-0 relative z-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h1 className="text-xl font-normal text-black dark:text-stone-100 tracking-tight leading-tight">{classData.name}</h1>
                <p className="text-stone-500 dark:text-stone-400 text-lg">{classData.professor}</p>
              </div>

              {/* Navigation Toggle / Tabs */}
              <div className="bg-gray-100 p-1 rounded-lg inline-flex items-center">
                <button
                  onClick={() => setActiveTab('blueprints')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'blueprints'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                  Blueprints
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'documents'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                  Documents
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-12 bg-transparent relative z-10">

          {/* Content Logic */}
          <div className="min-h-[400px]">
            {activeTab === 'documents' && (
              <div className="min-h-[300px]">
                {documents.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-base font-medium text-gray-900">Your Documents</h3>
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
                          className={`flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-all text-gray-700 cursor-pointer shadow-sm text-sm font-medium ${uploadingDocument ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {uploadingDocument ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              <span>Upload Document</span>
                            </>
                          )}
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="bg-white border border-gray-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group relative flex flex-col h-full cursor-pointer hover:border-gray-400"
                          onClick={(e) => handleViewDocument(e, doc)}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-sm flex items-center justify-center text-black dark:text-stone-400">
                              <FileText className="w-5 h-5" />
                            </div>

                            <div className="relative">
                              <button
                                onClick={(e) => toggleDropdown(e, doc.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {openDropdownId === doc.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => handleViewDocument(e, doc)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Eye className="w-4 h-4" />
                                    View
                                  </button>
                                  <a
                                    href={doc.file_url}
                                    download
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Download className="w-4 h-4" />
                                    Download
                                  </a>
                                  <button
                                    onClick={(e) => handleDeleteDocument(e, doc.id, doc.file_path)}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mb-2">
                            <h4 className="text-sm font-medium text-gray-900 mb-1 truncate" title={doc.name}>
                              {doc.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {(doc.file_size / 1024).toFixed(1)} KB
                            </p>
                          </div>

                          <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                      <FolderOpen className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No documents yet</h3>
                    <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                      Upload syllabus, assignments, and notes to share with your class.
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
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all text-gray-700 cursor-pointer shadow-sm text-sm font-medium ${uploadingDocument ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {uploadingDocument ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Upload Document</span>
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
                      <h3 className="text-base font-medium text-gray-900">Your Blueprints</h3>
                      <button
                        onClick={() => navigate('/create', { state: { initialClassId: id } })}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-all shadow-sm text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        <span>New Blueprint</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {blueprints.map((blueprint) => (
                        <div
                          key={blueprint.id}
                          onClick={() => navigate(`/blueprint/${blueprint.id}`)}
                          className="bg-white border border-gray-300 rounded-xl p-5 shadow-sm hover:shadow-md cursor-pointer transition-all group relative flex flex-col h-full hover:border-gray-400"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-sm flex items-center justify-center text-black dark:text-stone-400">
                              <PenTool className="w-5 h-5" />
                            </div>

                            <div className="relative">
                              <button
                                onClick={(e) => toggleDropdown(e, blueprint.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {openDropdownId === blueprint.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => handleEditBlueprint(e, blueprint)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Edit Name
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteBlueprint(e, blueprint.id)}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mb-2">
                            <h4 className="text-sm font-medium text-gray-900 mb-1 truncate" title={blueprint.title || blueprint.content?.blueprintName || 'Untitled Blueprint'}>
                              {blueprint.title || blueprint.content?.blueprintName || 'Untitled Blueprint'}
                            </h4>
                            <p className="text-xs text-gray-500 line-clamp-2 h-8">
                              {blueprint.task_type}
                            </p>
                          </div>

                          <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                            <span>{new Date(blueprint.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                      <PenTool className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No blueprints yet</h3>
                    <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                      Create and manage your engineering blueprints for this class.
                    </p>
                    <button
                      onClick={() => navigate('/create', { state: { initialClassId: id } })}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-all shadow-sm text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Blueprint</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  );
};

export default ClassDetails;

