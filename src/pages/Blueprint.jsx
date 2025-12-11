import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Target, Calendar, FileText, Loader2, Download, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const Blueprint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchBlueprint();
    }
  }, [user, id]);

  const fetchBlueprint = async () => {
    try {
      const { data, error } = await supabase
        .from('blueprints')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setBlueprint(data);
    } catch (error) {
      console.error('Error fetching blueprint:', error);
      alert('Failed to load blueprint');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F4E3] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4A1C]" />
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="min-h-screen bg-[#F8F4E3] flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-600 mb-4">Blueprint not found</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-[#FF4A1C] text-white rounded-xl hover:bg-black transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const content = blueprint.content || {};
  // Fallback to content JSON if new columns are empty (for backward compatibility)
  const blueprintName = blueprint.title || content.blueprintName;
  const description = blueprint.description || content.textInput;
  const fileInfo = blueprint.file_metadata || content.fileUpload;

  return (
    <div className="min-h-screen bg-[#F8F4E3] pt-24 pb-12 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => {
              if (blueprint.class_id) {
                navigate(`/class/${blueprint.class_id}`);
              } else {
                navigate('/dashboard');
              }
            }}
            className="flex items-center gap-2 text-stone-600 hover:text-[#FF4A1C] transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">
              {blueprint.class_id ? 'Back to Class' : 'Back to Dashboard'}
            </span>
          </button>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-[#2A2B2A] mb-2">
                  {blueprintName || 'Untitled Blueprint'}
                </h1>
                <p className="text-stone-500 text-lg">
                  Created on {new Date(blueprint.created_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <div className="p-3 bg-[#FF4A1C]/10 rounded-2xl">
                <FileText className="w-8 h-8 text-[#FF4A1C]" />
              </div>
            </div>

            {/* Blueprint Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-stone-100">
              {content.className && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase">Class</p>
                    <p className="text-[#2A2B2A] font-semibold">{content.className}</p>
                  </div>
                </div>
              )}

              {content.professorName && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase">Professor</p>
                    <p className="text-[#2A2B2A] font-semibold">{content.professorName}</p>
                  </div>
                </div>
              )}

              {blueprint.task_type && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Target className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase">Task Type</p>
                    <p className="text-[#2A2B2A] font-semibold">{blueprint.task_type}</p>
                  </div>
                </div>
              )}

              {blueprint.goal_type && blueprint.goal_type !== 'Not specified' && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Target className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase">Goal</p>
                    <p className="text-[#2A2B2A] font-semibold">{blueprint.goal_type}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Context Section */}
        {(description || fileInfo) && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100 mb-8">
            <h2 className="text-2xl font-bold text-[#2A2B2A] mb-4">Context Provided</h2>
            
            {description && (
              <div className="bg-stone-50 rounded-xl p-6 mb-4">
                <p className="text-stone-700 whitespace-pre-wrap">{description}</p>
              </div>
            )}

            {fileInfo && (
              <div className="bg-[#FF4A1C]/5 border-2 border-[#FF4A1C]/20 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white rounded-lg">
                      <FileText className="w-6 h-6 text-[#FF4A1C]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#2A2B2A]">Uploaded Document</p>
                      <p className="text-sm text-stone-600">{fileInfo.name}</p>
                      <p className="text-xs text-stone-500 mt-1">
                        {(fileInfo.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  {fileInfo.url && (
                    <div className="flex gap-2">
                      <a
                        href={fileInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-white text-[#FF4A1C] rounded-lg hover:bg-stone-50 transition-colors font-medium inline-flex items-center gap-2 border border-[#FF4A1C]/20"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View
                      </a>
                      <a
                        href={fileInfo.url}
                        download
                        className="px-4 py-2 bg-[#FF4A1C] text-white rounded-lg hover:bg-black transition-colors font-medium inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Blueprint Content Placeholder */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100">
          <h2 className="text-2xl font-bold text-[#2A2B2A] mb-6">Your Learning Blueprint</h2>
          
          <div className="space-y-6">
            {/* Placeholder Content */}
            <div className="bg-gradient-to-br from-[#FF4A1C]/5 to-purple-50 rounded-2xl p-8 text-center border-2 border-dashed border-stone-200">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <FileText className="w-8 h-8 text-[#FF4A1C]" />
              </div>
              <h3 className="text-xl font-bold text-[#2A2B2A] mb-2">
                Blueprint Generated Successfully!
              </h3>
              <p className="text-stone-600 mb-6 max-w-md mx-auto">
                Your personalized learning blueprint is ready. This is where your customized study plan, 
                resources, and step-by-step guidance will appear.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm">
                <Calendar className="w-4 h-4 text-[#FF4A1C]" />
                <span className="text-sm font-medium text-stone-600">
                  AI-powered content coming soon
                </span>
              </div>
            </div>

            {/* Future sections placeholder */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-stone-50 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-bold text-[#2A2B2A] mb-1">Study Materials</h4>
                <p className="text-sm text-stone-500">Curated resources</p>
              </div>

              <div className="bg-stone-50 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Target className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-bold text-[#2A2B2A] mb-1">Practice Problems</h4>
                <p className="text-sm text-stone-500">Hands-on exercises</p>
              </div>

              <div className="bg-stone-50 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <h4 className="font-bold text-[#2A2B2A] mb-1">Study Schedule</h4>
                <p className="text-sm text-stone-500">Time management</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Blueprint;

