import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Plus, ChevronRight, Loader2 } from 'lucide-react';

const ClassSidebar = () => {
  const { id: activeClassId } = useParams();
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchClasses();
    }
  }, [user]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] bg-white border-r border-stone-200 flex flex-col w-56">
      {/* Header */}
      <div className="p-4 border-b border-stone-100 flex justify-between items-center">
        <h2 className="font-semibold text-stone-900">My Classes</h2>
        <Link 
          to="/create"
          className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-900 transition-colors"
          title="Create New Class"
        >
          <Plus className="w-4 h-4" />
        </Link>
      </div>

      {/* Class List */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
          </div>
        ) : classes.length > 0 ? (
          <div className="space-y-1 px-2">
            {classes.map((course) => {
              const isActive = activeClassId === course.id;
              return (
                <Link
                  key={course.id}
                  to={`/class/${course.id}`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border group ${
                    isActive 
                      ? 'bg-stone-100 text-stone-900 border-stone-300 shadow-sm' 
                      : 'text-stone-500 border-transparent hover:bg-stone-50 hover:text-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1">
                    <BookOpen className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isActive ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-500'
                    }`} />
                    <span className="truncate">{course.name}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-stone-400" />}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-stone-500 mb-4">No classes found.</p>
            <Link 
              to="/create"
              className="text-xs font-medium text-[#FF4A1C] hover:text-[#d43b15]"
            >
              Create your first class
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassSidebar;
