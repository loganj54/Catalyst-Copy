import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, BookOpen, MoreVertical, Edit2, Trash2, Loader2, FileText, Zap, Search,
  Grid, Layout, Circle
} from 'lucide-react';
import CreateClassModal from '../components/CreateClassModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const ClassworkDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bgMode, setBgMode] = useState('dots'); // 'default', 'white', 'dots'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const dropdownRef = useRef(null);
  
  const [classes, setClasses] = useState([]);
  const [recentBlueprints, setRecentBlueprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, classId: null });

  // Fetch classes and recent blueprints on load
  useEffect(() => {
    if (user) {
      fetchClasses();
      fetchRecentBlueprints();
    }
  }, [user]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map database fields to UI fields
      // Assign random colors since we don't store them yet
      const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500', 'bg-indigo-500'];
      
      const formattedClasses = data.map((c, index) => ({
        id: c.id,
        name: c.name,
        professor: c.professor || '',
        color: colors[index % colors.length], // Consistent color based on index/order
        nextExam: 'TBD', // Placeholder as it's not in DB
        students: 0 // Placeholder
      }));

      setClasses(formattedClasses);
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentBlueprints = async () => {
    try {
      const { data, error } = await supabase
        .from('blueprints')
        .select('*, classes(name)')
        .eq('user_id', user.id)
        .order('last_viewed_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      setRecentBlueprints(data || []);
    } catch (error) {
      console.error('Error fetching recent blueprints:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateOrUpdateClass = async (classData) => {
    try {
      if (classData.id) {
        // Edit existing class
        const { error } = await supabase
          .from('classes')
          .update({
            name: classData.className,
            professor: classData.professor
          })
          .eq('id', classData.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Create new class
        const { error } = await supabase
          .from('classes')
          .insert([{
            user_id: user.id,
            name: classData.className,
            professor: classData.professor
          }]);

        if (error) throw error;
      }
      
      // Refresh list
      fetchClasses();
      setEditingClass(null);
    } catch (error) {
      console.error('Error saving class:', error);
      alert('Error saving class');
    }
  };

  const openEditModal = (course, e) => {
    e.stopPropagation(); // Prevent card click
    setEditingClass(course);
    setIsModalOpen(true);
    setActiveDropdown(null);
  };

  const handleDeleteClass = async (id, e) => {
    e.stopPropagation(); // Prevent card click
    setConfirmDialog({ isOpen: true, classId: id });
    setActiveDropdown(null);
  };

  const confirmDeleteClass = async () => {
    const { classId } = confirmDialog;
    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setClasses(classes.filter(c => c.id !== classId));
    } catch (error) {
      console.error('Error deleting class:', error);
      alert('Error deleting class');
    }
  };

  const toggleDropdown = (id, e) => {
    e.stopPropagation();
    if (activeDropdown === id) {
      setActiveDropdown(null);
      setDropdownPosition(null);
    } else {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        right: document.documentElement.clientWidth - rect.right
      });
      setActiveDropdown(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClass(null);
  };

  // Background Patterns
  const pageBackground = `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23a8a29e' fill-opacity='0.25'%3E%3Ccircle cx='5' cy='5' r='1.5'/%3E%3Ccircle cx='25' cy='5' r='1.5'/%3E%3Ccircle cx='65' cy='5' r='1.5'/%3E%3Ccircle cx='25' cy='25' r='1.5'/%3E%3Ccircle cx='45' cy='25' r='1.5'/%3E%3Ccircle cx='85' cy='25' r='1.5'/%3E%3Ccircle cx='5' cy='45' r='1.5'/%3E%3Ccircle cx='45' cy='45' r='1.5'/%3E%3Ccircle cx='65' cy='45' r='1.5'/%3E%3Ccircle cx='25' cy='65' r='1.5'/%3E%3Ccircle cx='65' cy='65' r='1.5'/%3E%3Ccircle cx='85' cy='65' r='1.5'/%3E%3Ccircle cx='5' cy='85' r='1.5'/%3E%3Ccircle cx='25' cy='85' r='1.5'/%3E%3Ccircle cx='85' cy='85' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`;

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-stone-900 flex items-center justify-center">
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-white dark:bg-stone-900 flex relative transition-colors duration-200"
      style={{ backgroundImage: bgMode === 'dots' ? pageBackground : 'none' }}
    >
      {/* Background Toggle - Development Only */}
      <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-stone-800 p-2 rounded-xl border border-stone-200 dark:border-stone-700 shadow-lg flex items-center gap-2">
        <button
          onClick={() => setBgMode('default')}
          className={`p-2 rounded-lg transition-colors ${bgMode === 'default' ? 'bg-stone-100 dark:bg-stone-700 text-[#FF4A1C]' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}
          title="Default Grid"
        >
          <Grid className="w-5 h-5" />
        </button>
        <button
          onClick={() => setBgMode('white')}
          className={`p-2 rounded-lg transition-colors ${bgMode === 'white' ? 'bg-stone-100 dark:bg-stone-700 text-[#FF4A1C]' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}
          title="Pure White"
        >
          <Layout className="w-5 h-5" />
        </button>
        <button
          onClick={() => setBgMode('dots')}
          className={`p-2 rounded-lg transition-colors ${bgMode === 'dots' ? 'bg-stone-100 dark:bg-stone-700 text-[#FF4A1C]' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}
          title="Dot Matrix"
        >
          <Circle className="w-5 h-5" />
        </button>
      </div>

       {/* Backgrounds */}
       {bgMode === 'default' && (
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-20"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white dark:from-stone-900 dark:via-transparent dark:to-stone-900"></div>
          </div>
        )}

      {/* Main Content Area - Pushed right by sidebar width */}
      <div className="flex-1 min-w-0 lg:ml-64 relative z-10">
        <div className="pt-8 pb-12 px-6 lg:px-12 max-w-7xl mx-auto space-y-12">
          
          <CreateClassModal 
            isOpen={isModalOpen} 
            onClose={handleCloseModal} 
            onSubmit={handleCreateOrUpdateClass}
            initialData={editingClass}
          />
          
          <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            onClose={() => setConfirmDialog({ isOpen: false, classId: null })}
            onConfirm={confirmDeleteClass}
            title="Are you sure?"
            message="Are you sure you want to delete this class? This action cannot be undone."
            confirmText="Yes"
            cancelText="No"
            type="danger"
          />
          
          {/* Header */}
          <div className="flex justify-between items-end">
            <div>
              <div className="inline-block text-6xl text-stone-900 dark:text-white tracking-tight rounded-3xl ">
                <h1 className="text-4xl font-normal text-[#2A2B2A] dark:text-white tracking-tight ">My Classwork</h1>
                </div>
                
            </div>
          </div>

          {/* Recent Blueprints Section (Table View) */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div className="inline-block text-6xl text-stone-900 dark:text-white tracking-tight rounded-3xl ">
                <h2 className="text-3xl font-normal text-[#2A2B2A] dark:text-white tracking-tight mb-2">Recent Blueprints</h2>
              </div>
              <button 
                onClick={() => navigate('/create')}
                className="flex items-center justify-center gap-2 w-40 px-5 py-2.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-all text-[#2A2B2A] dark:text-white"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium text-sm">New Blueprint</span>
              </button>
            </div>

            <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-300 dark:border-stone-700 overflow-hidden shadow-sm">
              {recentBlueprints.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                      <thead>
                        <tr className="bg-stone-50 dark:bg-stone-800 border-b border-stone-300 dark:border-stone-700 text-left">
                          <th className="py-2 px-6 font-normal text-stone-500 dark:text-stone-400 text-sm w-full">Blueprint </th>
                          <th className="py-2 px-6 font-normal text-stone-500 dark:text-stone-400 text-sm whitespace-nowrap text-left w-1">Last Viewed</th>
                          
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-300 dark:divide-stone-700">
                        {recentBlueprints.map((blueprint) => (
                          <tr 
                            key={blueprint.id} 
                            onClick={() => navigate(`/blueprint/${blueprint.id}`)}
                            className="hover:bg-stone-50/50 dark:hover:bg-stone-800/50 cursor-pointer transition-colors group"
                          >
                            <td className="py-2 px-6">
                              <div className="flex items-center gap-4">
                                <div>
                                  <h3 className="font-normal text-[#2A2B2A] dark:text-white transition-colors">
                                    {blueprint.title || 'Untitled Blueprint'}
                                  </h3>
                                  <p className="text-stone-400 dark:text-stone-500 text-sm line-clamp-1 max-w-xs">
                                    {blueprint.classes?.name || 'Unassigned'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-6 text-stone-500 dark:text-stone-400 font-normal text-left whitespace-nowrap">
                              {new Date(blueprint.last_viewed_at || blueprint.created_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center">
                 
                  <h3 className="text-lg font-bold text-[#2A2B2A] dark:text-white mb-1">No blueprints found</h3>
                  <p className="text-stone-500 dark:text-stone-400 mb-6">Create your first blueprint to get started.</p>
                  <button 
                    onClick={() => navigate('/create')}
                    className="px-6 py-2 bg-[#2A2B2A] dark:bg-white text-white dark:text-black rounded-xl hover:bg-black dark:hover:bg-stone-200 transition-colors font-medium"
                  >
                    Create Blueprint
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Classes Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div className="inline-block bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm rounded-lg">
                <h2 className="text-3xl font-normal text-[#2A2B2A] dark:text-white tracking-tight mb-2">All Classes</h2>
              </div>
              <button 
                onClick={() => { setEditingClass(null); setIsModalOpen(true); }}
                className="flex items-center justify-center gap-2 w-40 px-5 py-2.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-all text-[#2A2B2A] dark:text-white"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium text-sm">New Class</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Class Cards */}
              {classes.map((course) => (
                <div 
                  key={course.id}
                  onClick={() => navigate(`/class/${course.id}`)}
                  className="aspect-square bg-white dark:bg-stone-900 rounded-xl p-6 shadow-sm hover:shadow-xl transition-all group relative flex flex-col justify-between overflow-hidden cursor-pointer border border-stone-300 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-600"
                >
                  {/* Card Header */}
                  <div className="flex justify-between items-start z-10 relative">
                    <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 dark:text-stone-400 shadow-md">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    
                    {/* Dropdown Menu Button */}
                    <button 
                      onClick={(e) => toggleDropdown(course.id, e)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 dark:text-stone-500 hover:text-[#2A2B2A] dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-all relative z-10"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Card Content */}
                  <div className="z-10 mt-4">
                    <h3 className="text-2xl font-normal text-[#2A2B2A] dark:text-white mb-1 leading-tight  transition-colors line-clamp-2">
                      {course.name}
                    </h3>
                    <p className="text-stone-500 dark:text-stone-400 font-normal truncate">{course.professor}</p>
                  </div>

                  {/* Card Footer / Stats */}
                  <div className="z-10 mt-auto pt-6 border-t border-stone-300 dark:border-stone-700">
                    <div className="flex justify-between items-center text-sm">
                       <div className="flex flex-col">
                         <span className="text-stone-400 dark:text-stone-500 text-xs font-normal uppercase">Next Exam</span>
                         <span className="font-normal text-[#2A2B2A] dark:text-white">{course.nextExam}</span>
                       </div>
                       <div className="h-8 w-[1px] bg-stone-300 dark:bg-stone-700"></div>
                       <div className="flex flex-col items-end">
                         <span className="text-stone-400 dark:text-stone-500 text-xs font-normal uppercase">Progress</span>
                         <span className="font-normal text-green-600 dark:text-green-500">On Track</span>
                       </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* Fixed Dropdown Menu - Rendered Outside Cards */}
      {activeDropdown && dropdownPosition && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown(null);
              setDropdownPosition(null);
            }}
          />
          {/* Dropdown */}
          <div 
            ref={dropdownRef}
            className="absolute bg-white dark:bg-stone-800 rounded-xl shadow-xl border border-stone-200 dark:border-stone-700 overflow-hidden z-50 w-48"
            style={{ 
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`
            }}
          >
            <button 
              onClick={(e) => {
                const course = classes.find(c => c.id === activeDropdown);
                if (course) openEditModal(course, e);
              }}
              className="w-full px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center gap-2 text-stone-600 dark:text-stone-300 font-medium transition-colors"
            >
              <Edit2 className="w-4 h-4" /> Edit Class
            </button>
            <button 
              onClick={(e) => handleDeleteClass(activeDropdown, e)}
              className="w-full px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-2 font-medium transition-colors border-t border-stone-100 dark:border-stone-700"
            >
              <Trash2 className="w-4 h-4" /> Remove Class
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ClassworkDashboard;

