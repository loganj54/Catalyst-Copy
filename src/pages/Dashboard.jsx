import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, MoreVertical, Calendar, TrendingUp, Edit2, Trash2, Loader2, Briefcase, GraduationCap, Trophy } from 'lucide-react';
import CreateClassModal from '../components/CreateClassModal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const dropdownRef = useRef(null);
  
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch classes on load
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
    if (window.confirm('Are you sure you want to delete this class?')) {
      try {
        const { error } = await supabase
          .from('classes')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;
        
        setClasses(classes.filter(c => c.id !== id));
      } catch (error) {
        console.error('Error deleting class:', error);
        alert('Error deleting class');
      }
    }
    setActiveDropdown(null);
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
        right: window.innerWidth - rect.right - window.scrollX
      });
      setActiveDropdown(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClass(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F4E3] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4A1C]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F4E3] pt-24 pb-12 px-6 lg:px-12">
      <CreateClassModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSubmit={handleCreateOrUpdateClass}
        initialData={editingClass}
      />
      
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold text-[#2A2B2A] mb-2">My Dashboard</h1>
            <p className="text-stone-500 text-lg">Track your academic journey and career progress.</p>
          </div>
          
        </div>

        {/* Classes Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-[#2A2B2A]">Classes</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Create New Class Card (Always First) */}
            <button 
              onClick={() => { setEditingClass(null); setIsModalOpen(true); }}
              className="aspect-square bg-transparent border-3 border-dashed border-stone-300 rounded-3xl flex flex-col items-center justify-center gap-4 text-stone-400 hover:text-[#FF4A1C] hover:border-[#FF4A1C] hover:bg-[#FF4A1C]/5 transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-stone-100 group-hover:bg-[#FF4A1C]/10 flex items-center justify-center transition-colors">
                <Plus className="w-8 h-8" />
              </div>
              <span className="font-bold text-lg">Create New Class</span>
            </button>

            {/* Class Cards */}
            {classes.map((course) => (
              <div 
                key={course.id}
                onClick={() => navigate(`/class/${course.id}`)}
                className="aspect-square bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative flex flex-col justify-between overflow-hidden cursor-pointer border border-transparent hover:border-stone-100"
              >
                {/* Card Header */}
                <div className="flex justify-between items-start z-10 relative">
                  <div className={`w-12 h-12 rounded-2xl ${course.color} flex items-center justify-center text-white shadow-md`}>
                    <BookOpen className="w-6 h-6" />
                  </div>
                  
                  {/* Dropdown Menu Button */}
                  <button 
                    onClick={(e) => toggleDropdown(course.id, e)}
                    className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-[#2A2B2A] transition-colors relative z-10"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>

                {/* Card Content */}
                <div className="z-10 mt-4">
                  <h3 className="text-2xl font-bold text-[#2A2B2A] mb-1 leading-tight group-hover:text-[#FF4A1C] transition-colors line-clamp-2">
                    {course.name}
                  </h3>
                  <p className="text-stone-500 font-medium truncate">{course.professor}</p>
                </div>

                {/* Card Footer / Stats */}
                <div className="z-10 mt-auto pt-6 border-t border-stone-100">
                  <div className="flex justify-between items-center text-sm">
                     <div className="flex flex-col">
                       <span className="text-stone-400 text-xs font-bold uppercase">Next Exam</span>
                       <span className="font-bold text-[#2A2B2A]">{course.nextExam}</span>
                     </div>
                     <div className="h-8 w-[1px] bg-stone-100"></div>
                     <div className="flex flex-col items-end">
                       <span className="text-stone-400 text-xs font-bold uppercase">Progress</span>
                       <span className="font-bold text-green-600">On Track</span>
                     </div>
                  </div>
                </div>

                {/* Decorative Background Blob */}
                <div className={`absolute -bottom-16 -right-16 w-48 h-48 ${course.color} opacity-5 rounded-full blur-3xl group-hover:opacity-10 transition-opacity`}></div>
              </div>
            ))}
          </div>
        </section>

        {/* Projects Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
              <Briefcase className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-[#2A2B2A]">Projects</h2>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-stone-100 text-center">
            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-300">
              <Briefcase className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#2A2B2A] mb-1">No projects yet</h3>
            <p className="text-stone-500 mb-6">Start documenting your engineering projects to showcase your skills.</p>
            <button className="px-6 py-2 bg-[#2A2B2A] text-white rounded-xl hover:bg-black transition-colors font-medium">
              Add Project
            </button>
          </div>
        </section>

        {/* Learning Skills Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-[#2A2B2A]">Learning Skills</h2>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-stone-100 text-center">
            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-300">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#2A2B2A] mb-1">Track your skills</h3>
            <p className="text-stone-500 mb-6">Keep track of new technologies and concepts you're learning.</p>
            <button className="px-6 py-2 bg-[#2A2B2A] text-white rounded-xl hover:bg-black transition-colors font-medium">
              Add Skill
            </button>
          </div>
        </section>

        {/* Career Progress Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 rounded-lg text-green-600">
              <Trophy className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-[#2A2B2A]">Career Progress</h2>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-stone-100 text-center">
             <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-300">
              <Trophy className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#2A2B2A] mb-1">Career Timeline</h3>
            <p className="text-stone-500 mb-6">Visualize your internships, jobs, and career milestones.</p>
            <button className="px-6 py-2 bg-[#2A2B2A] text-white rounded-xl hover:bg-black transition-colors font-medium">
              Update Timeline
            </button>
          </div>
        </section>
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
            className="fixed bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden z-50 w-48"
            style={{ 
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
              backgroundColor: 'white'
            }}
          >
            <button 
              onClick={(e) => {
                const course = classes.find(c => c.id === activeDropdown);
                if (course) openEditModal(course, e);
              }}
              className="w-full px-4 py-3 text-left hover:bg-stone-50 flex items-center gap-2 text-stone-600 font-medium transition-colors"
            >
              <Edit2 className="w-4 h-4" /> Edit Class
            </button>
            <button 
              onClick={(e) => handleDeleteClass(activeDropdown, e)}
              className="w-full px-4 py-3 text-left hover:bg-red-50 text-red-500 hover:text-red-600 flex items-center gap-2 font-medium transition-colors border-t border-stone-100"
            >
              <Trash2 className="w-4 h-4" /> Remove Class
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;

