import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  FileText, 
  PenTool, 
  HelpCircle, 
  Plus, 
  MoreVertical,
  Loader2,
  FolderOpen,
  Calendar,
  Clock,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Upload,
  Download,
  Eye
} from 'lucide-react';
import BlueprintModal from '../components/BlueprintModal';

const ClassDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  
  const [classData, setClassData] = useState(null);
  const [blueprints, setBlueprints] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [activeTab, setActiveTab] = useState('documents'); // documents, blueprints, help
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);

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
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${id}/${Date.now()}.${fileExt}`;
      
      console.log('Attempting to upload file:', fileName);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('class documents')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        
        // Check for specific errors
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
          alert('⚠️ Storage bucket not set up!\n\nPlease create the "class documents" bucket in Supabase:\n1. Go to Storage in Supabase Dashboard\n2. Create new bucket named "class documents"\n3. Set it to Public\n4. Add storage policies (see STORAGE_SETUP.md)');
          return;
        }
        
        throw uploadError;
      }

      console.log('File uploaded successfully, getting public URL...');
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('class documents')
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
    
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      try {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('class documents')
          .remove([filePath]);

        if (storageError) console.error('Storage delete error:', storageError);

        // Delete from database
        const { error: dbError } = await supabase
          .from('class_documents')
          .delete()
          .eq('id', documentId);

        if (dbError) throw dbError;

        setDocuments(documents.filter(doc => doc.id !== documentId));
        setOpenDropdownId(null);
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Failed to delete document');
      }
    }
  };

  const handleDeleteBlueprint = async (e, blueprintId) => {
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this blueprint? This action cannot be undone.')) {
      try {
        const { error } = await supabase
          .from('blueprints')
          .delete()
          .eq('id', blueprintId);

        if (error) throw error;

        setBlueprints(blueprints.filter(bp => bp.id !== blueprintId));
        setOpenDropdownId(null);
      } catch (error) {
        console.error('Error deleting blueprint:', error);
        alert('Failed to delete blueprint');
      }
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
      <div className="min-h-screen bg-[#F8F4E3] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4A1C]" />
      </div>
    );
  }

  if (!classData) return null;

  return (
    <div className="min-h-screen bg-[#F8F4E3] pt-24 pb-12 px-6 lg:px-12">
      {isBlueprintModalOpen && (
        <BlueprintModal 
          isOpen={isBlueprintModalOpen}
          onClose={() => setIsBlueprintModalOpen(false)}
          classId={id}
          className={classData.name}
          professorName={classData.professor}
        />
      )}
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-6 mb-12">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-stone-500 hover:text-[#2A2B2A] transition-colors w-fit"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-bold text-[#2A2B2A] mb-2">{classData.name}</h1>
              <p className="text-stone-500 text-lg">Professor: {classData.professor}</p>
            </div>
            
            <div className="flex gap-3">
              <button className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-[#2A2B2A] transition-colors">
                <MoreVertical className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 border-b border-stone-200 pb-1 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('documents')}
            className={`px-6 py-3 rounded-t-xl font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'documents' 
                ? 'bg-white text-[#FF4A1C] shadow-sm border-t border-x border-stone-100' 
                : 'text-stone-500 hover:text-[#2A2B2A] hover:bg-stone-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            Documents
          </button>
          <button 
            onClick={() => setActiveTab('blueprints')}
            className={`px-6 py-3 rounded-t-xl font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'blueprints' 
                ? 'bg-white text-[#FF4A1C] shadow-sm border-t border-x border-stone-100' 
                : 'text-stone-500 hover:text-[#2A2B2A] hover:bg-stone-50'
            }`}
          >
            <PenTool className="w-5 h-5" />
            Blueprints
          </button>
          <button 
            onClick={() => setActiveTab('help')}
            className={`px-6 py-3 rounded-t-xl font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'help' 
                ? 'bg-white text-[#FF4A1C] shadow-sm border-t border-x border-stone-100' 
                : 'text-stone-500 hover:text-[#2A2B2A] hover:bg-stone-50'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            Help & Resources
          </button>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-3xl p-8 min-h-[400px] shadow-sm">
          {activeTab === 'documents' && (
            <div className="min-h-[300px]">
              {documents.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-[#2A2B2A]">Your Documents</h3>
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
                        className={`px-4 py-2 bg-[#2A2B2A] text-white rounded-lg hover:bg-black transition-colors font-medium inline-flex items-center gap-2 text-sm cursor-pointer ${uploadingDocument ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {uploadingDocument ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Upload Document
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map((doc) => (
                      <div 
                        key={doc.id}
                        className="bg-stone-50 hover:bg-white border border-stone-100 hover:border-[#FF4A1C]/20 rounded-xl p-5 transition-all shadow-sm hover:shadow-md group relative"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="p-2 bg-white rounded-lg text-[#FF4A1C] shadow-sm">
                            <FileText className="w-5 h-5" />
                          </div>
                          
                          <div className="relative">
                            <button
                              onClick={(e) => toggleDropdown(e, doc.id)}
                              className="p-1.5 hover:bg-stone-200 rounded-lg text-stone-400 hover:text-[#2A2B2A] transition-colors"
                            >
                              <MoreHorizontal className="w-5 h-5" />
                            </button>
                            
                            {openDropdownId === doc.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-stone-100 py-1 z-10 animate-fade-in">
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full px-4 py-2 text-left text-sm text-stone-600 hover:bg-stone-50 flex items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </a>
                                <a
                                  href={doc.file_url}
                                  download
                                  className="w-full px-4 py-2 text-left text-sm text-stone-600 hover:bg-stone-50 flex items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download className="w-4 h-4" />
                                  Download
                                </a>
                                <button
                                  onClick={(e) => handleDeleteDocument(e, doc.id, doc.file_path)}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <h4 className="font-bold text-[#2A2B2A] mb-1 truncate pr-8">
                          {doc.name}
                        </h4>
                        <p className="text-sm text-stone-500 mb-4">
                          {(doc.file_size / 1024).toFixed(1)} KB
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-stone-400 pt-4 border-t border-stone-200/60">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(doc.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6 text-stone-300">
                    <FolderOpen className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-[#2A2B2A] mb-2">Class Documents</h3>
                  <p className="text-stone-500 mb-8 max-w-md mx-auto">
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
                    className={`px-6 py-3 bg-[#2A2B2A] text-white rounded-xl hover:bg-black transition-colors font-medium inline-flex items-center gap-2 cursor-pointer ${uploadingDocument ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {uploadingDocument ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Upload Document
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
                    <h3 className="text-xl font-bold text-[#2A2B2A]">Your Blueprints</h3>
                    <button 
                      onClick={() => setIsBlueprintModalOpen(true)}
                      className="px-4 py-2 bg-[#2A2B2A] text-white rounded-lg hover:bg-black transition-colors font-medium inline-flex items-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      New Blueprint
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {blueprints.map((blueprint) => (
                      <div 
                        key={blueprint.id}
                        onClick={() => navigate(`/blueprint/${blueprint.id}`)}
                        className="bg-stone-50 hover:bg-white border border-stone-100 hover:border-[#FF4A1C]/20 rounded-xl p-5 cursor-pointer transition-all shadow-sm hover:shadow-md group relative"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="p-2 bg-white rounded-lg text-[#FF4A1C] shadow-sm">
                            <PenTool className="w-5 h-5" />
                          </div>
                          
                          <div className="relative">
                            <button
                              onClick={(e) => toggleDropdown(e, blueprint.id)}
                              className="p-1.5 hover:bg-stone-200 rounded-lg text-stone-400 hover:text-[#2A2B2A] transition-colors"
                            >
                              <MoreHorizontal className="w-5 h-5" />
                            </button>
                            
                            {openDropdownId === blueprint.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-stone-100 py-1 z-10 animate-fade-in">
                                <button
                                  onClick={(e) => handleDeleteBlueprint(e, blueprint.id)}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Blueprint
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <h4 className="font-bold text-[#2A2B2A] mb-1 truncate pr-8">
                          {blueprint.title || blueprint.content?.blueprintName || 'Untitled Blueprint'}
                        </h4>
                        <p className="text-sm text-stone-500 mb-4 line-clamp-2 h-10">
                          {blueprint.task_type}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-stone-400 pt-4 border-t border-stone-200/60">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(blueprint.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(blueprint.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6 text-stone-300">
                    <PenTool className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-[#2A2B2A] mb-2">Class Blueprints</h3>
                  <p className="text-stone-500 mb-8 max-w-md mx-auto">
                    Create and manage your engineering blueprints and diagrams for this class.
                  </p>
                  <button 
                    onClick={() => setIsBlueprintModalOpen(true)}
                    className="px-6 py-3 bg-[#2A2B2A] text-white rounded-xl hover:bg-black transition-colors font-medium inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    New Blueprint
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'help' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6 text-stone-300">
                <HelpCircle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-[#2A2B2A] mb-2">Need Help?</h3>
              <p className="text-stone-500 mb-8 max-w-md mx-auto">
                Find resources, study guides, and connect with tutors for {classData.name}.
              </p>
              <div className="flex gap-4 justify-center">
                <button className="px-6 py-3 bg-stone-100 text-[#2A2B2A] rounded-xl hover:bg-stone-200 transition-colors font-medium">
                  Find a Tutor
                </button>
                <button className="px-6 py-3 bg-[#2A2B2A] text-white rounded-xl hover:bg-black transition-colors font-medium">
                  View Resources
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassDetails;

