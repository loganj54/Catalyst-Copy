import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, MoreVertical, Edit2, Trash2, Loader2, BookOpen, ExternalLink, MoreHorizontal
} from 'lucide-react';

// Legacy components - keeping functionality
import CreateClassModal from '../components/CreateClassModal';
import ConfirmDialog from '../components/ConfirmDialog';

import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// New Dub-UI Components
import { Button } from '../components/dub-ui/Button';
import { Card } from '../components/dub-ui/Card';
import { Sidebar } from '../components/dub-ui/Sidebar';
import { Badge } from '../components/dub-ui/Badge';
import { Table, Thead, Tr, Th, Td } from '../components/dub-ui/Table';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);

  const [classes, setClasses] = useState([]);
  const [recentBlueprints, setRecentBlueprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, classId: null });

  // --- LOGIC SECTION (Preserved) ---

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
      const formattedClasses = data.map((c) => ({
        id: c.id,
        name: c.name,
        professor: c.professor || '',
        nextExam: 'TBD', // Placeholder
        progress: 'On Track' // Placeholder
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
        .neq('title', 'Untitled Blueprint')
        .order('last_viewed_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentBlueprints(data || []);
    } catch (error) {
      console.error('Error fetching recent blueprints:', error);
    }
  };

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
        const { error } = await supabase
          .from('classes')
          .update({ name: classData.className, professor: classData.professor })
          .eq('id', classData.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('classes')
          .insert([{ user_id: user.id, name: classData.className, professor: classData.professor }]);
        if (error) throw error;
      }
      fetchClasses();
      setEditingClass(null);
    } catch (error) {
      console.error('Error saving class:', error);
      alert('Error saving class');
    }
  };

  const openEditModal = (course, e) => {
    e.stopPropagation();
    setEditingClass(course);
    setIsModalOpen(true);
    setActiveDropdown(null);
  };

  const handleDeleteClass = async (id, e) => {
    e.stopPropagation();
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
    setActiveDropdown(activeDropdown === id ? null : id);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClass(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const { bgPattern } = useTheme(); // Import theme

  return (
    <div className="flex h-full w-full bg-stone-100 dark:bg-stone-950 p-4 lg:p-6 gap-4 lg:gap-6 overflow-hidden transition-colors duration-300">

      {/* 1. Sidebar Bubble */}
      <div className="hidden lg:flex flex-col w-[250px] bg-stone-50 rounded-2xl shadow-xl ring-1 ring-black/5 overflow-hidden">
        <Sidebar className="w-full h-full border-r-0 bg-stone-50" />
      </div>

      {/* 2. Main Content Bubble */}
      <div className={`flex-1 flex flex-col min-w-0 rounded-2xl shadow-xl ring-1 ring-black/5 overflow-hidden transition-all duration-300 relative bg-white dark:bg-stone-950`}>

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

        {/* Header Area */}
        <header className="px-8 py-6 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex-shrink-0 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-normal text-black dark:text-stone-100 tracking-tight">Classes</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 space-y-8 bg-transparent relative z-10">

          {/* Modals placed here */}
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
            title="Delete Class"
            message="Are you sure you want to delete this class? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            type="danger"
          />

          {/* Section: Recent Blueprints */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900">Recent Blueprints</h2>
              <Button
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={() => navigate('/create')}
              >
                New Blueprint
              </Button>
            </div>

            {recentBlueprints.length > 0 ? (
              <Table>
                <Thead>
                  <Tr className="bg-stone-100 dark:bg-stone-900 border-inherit">
                    <Th>Blueprint</Th>
                    <Th>Class</Th>
                    <Th>Last Viewed</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {recentBlueprints.map((blueprint) => (
                    <Tr
                      key={blueprint.id}
                      onClick={() => navigate(`/blueprint/${blueprint.id}`)}
                      className="cursor-pointer group bg-white dark:bg-stone-900 border-inherit"
                    >
                      <Td className="font-medium text-gray-900 group-hover:text-black">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                            <ExternalLink className="w-4 h-4" />
                          </div>
                          {blueprint.title || 'Untitled Blueprint'}
                        </div>
                      </Td>
                      <Td className="text-gray-500">
                        {blueprint.classes?.name ? (
                          <Badge variant="neutral">{blueprint.classes.name}</Badge>
                        ) : (
                          <span className="text-gray-400 text-xs">Unassigned</span>
                        )}
                      </Td>
                      <Td className="text-gray-500">
                        {new Date(blueprint.last_viewed_at || blueprint.created_at).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric'
                        })}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Card className="flex flex-col items-center justify-center py-12 text-center border-dashed">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Plus className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-900">No blueprints yet</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm">
                  Create your first blueprint to start tracking your coursework.
                </p>
                <Button className="mt-4" onClick={() => navigate('/create')}>Create Blueprint</Button>
              </Card>
            )}
          </section>

          {/* Section: Classes */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-gray-900">All Classes</h2>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => { setEditingClass(null); setIsModalOpen(true); }}
              >
                Add Class
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((course) => (
                <Card
                  key={course.id}
                  className="group hover:border-gray-300 hover:shadow-md transition-all cursor-pointer relative"
                  onClick={() => navigate(`/class/${course.id}`)}
                  noPadding
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center text-black">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="relative">
                        <button
                          onClick={(e) => toggleDropdown(course.id, e)}
                          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>

                        {/* Dropdown Menu */}
                        {activeDropdown === course.id && (
                          <div
                            className="absolute right-0 top-8 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100"
                            ref={dropdownRef}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => openEditModal(course, e)}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={(e) => handleDeleteClass(course.id, e)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-gray-900 leading-snug truncate pr-4">{course.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{course.professor}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 border-t border-gray-100 px-5 py-3 flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Next Exam</span>
                    <Badge variant="green" className="bg-white border border-green-100">On Track</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
};
export default Dashboard;
