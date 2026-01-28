import React, { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Plus, ChevronRight, Loader2, PenTool } from 'lucide-react';

const ClassSidebar = ({ className = '' }) => {
  const { id: routeId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for handling blueprints in sidebar
  const [expandedClassId, setExpandedClassId] = useState(null);
  const [classBlueprints, setClassBlueprints] = useState([]);
  const [loadingBlueprints, setLoadingBlueprints] = useState(false);

  const isBlueprintPage = location.pathname.includes('/blueprint/');
  const isClassPage = location.pathname.includes('/class/');

  useEffect(() => {
    if (user) {
      fetchClasses();
    }
  }, [user]);

  // Handle expanding class and fetching blueprints based on current route
  useEffect(() => {
    const handleRouteChange = async () => {
      if (!user || !routeId) return;

      if (isClassPage) {
        if (expandedClassId !== routeId) {
          setExpandedClassId(routeId);
          fetchBlueprints(routeId);
        }
      } else if (isBlueprintPage) {
        // If we're on a blueprint page, we need to find which class it belongs to
        try {
          const { data, error } = await supabase
            .from('blueprints')
            .select('class_id')
            .eq('id', routeId)
            .single();

          if (data && data.class_id) {
            if (expandedClassId !== data.class_id) {
              setExpandedClassId(data.class_id);
              fetchBlueprints(data.class_id);
            }
          }
        } catch (err) {
          console.error('Error identifying class from blueprint:', err);
        }
      }
    };

    handleRouteChange();
  }, [user, routeId, isClassPage, isBlueprintPage]);

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

  const fetchBlueprints = async (classId) => {
    setLoadingBlueprints(true);
    try {
      const { data, error } = await supabase
        .from('blueprints')
        .select('id, title, content, task_type')
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClassBlueprints(data || []);
    } catch (error) {
      console.error('Error fetching blueprints:', error);
    } finally {
      setLoadingBlueprints(false);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[#eeedec] ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="font-medium text-sm text-gray-500 uppercase tracking-wider pl-2">My Classes</h2>
        <Link
          to="/create"
          className="p-1.5 hover:bg-stone-200 rounded-md text-gray-400 hover:text-gray-700 transition-colors"
          title="Create New Class"
        >
          <Plus className="w-4 h-4" />
        </Link>
      </div>

      {/* Class List */}
      <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : classes.length > 0 ? (
          <div className="space-y-1">
            {classes.map((course) => {
              const isExpanded = expandedClassId === course.id;
              const isCurrentClassActive = (isClassPage && routeId === course.id) || isExpanded;

              return (
                <div key={course.id}>
                  <Link
                    to={`/class/${course.id}`}
                    onClick={() => {
                      if (expandedClassId !== course.id) {
                        setExpandedClassId(course.id);
                        fetchBlueprints(course.id);
                      }
                    }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all group ${isCurrentClassActive
                      ? 'bg-stone-200 text-gray-900 shadow-sm border border-gray-200'
                      : 'text-gray-600 border border-transparent hover:bg-stone-200 hover:text-gray-900'
                      }`}
                  >
                    <BookOpen className={`w-4 h-4 flex-shrink-0 ${isCurrentClassActive ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-500'
                      }`} />
                    <span className="truncate flex-1">{course.name}</span>
                    <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </Link>

                  {/* Indented Blueprints List */}
                  {isExpanded && (
                    <div className="ml-3 pl-3 border-l border-gray-200 mt-1 space-y-0.5">
                      {loadingBlueprints ? (
                        <div className="py-2 px-2">
                          <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                        </div>
                      ) : classBlueprints.length > 0 ? (
                        classBlueprints.map((bp) => {
                          const isBpActive = isBlueprintPage && routeId === bp.id;
                          const bpName = bp.title || bp.content?.blueprintName || 'Untitled';

                          return (
                            <Link
                              key={bp.id}
                              to={`/blueprint/${bp.id}`}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors block w-full text-left ${isBpActive
                                ? 'text-gray-900 bg-stone-200 font-medium'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-stone-200'
                                }`}
                            >
                              <PenTool className={`w-3 h-3 shrink-0 ${isBpActive ? 'text-gray-900' : 'text-gray-400'}`} />
                              <span className="truncate">{bpName}</span>
                            </Link>
                          );
                        })
                      ) : (
                        <div className="px-2 py-1 text-xs text-gray-400 italic">
                          No blueprints
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500 mb-4">No classes found.</p>
            <Link
              to="/create"
              className="text-xs font-medium text-black hover:underline"
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
