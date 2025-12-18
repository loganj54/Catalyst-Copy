import React from 'react';
import Sidebar from '../components/Sidebar';

const Projects = () => {
  // Background Patterns
  const pageBackground = `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23a8a29e' fill-opacity='0.25'%3E%3Ccircle cx='5' cy='5' r='1.5'/%3E%3Ccircle cx='25' cy='5' r='1.5'/%3E%3Ccircle cx='65' cy='5' r='1.5'/%3E%3Ccircle cx='25' cy='25' r='1.5'/%3E%3Ccircle cx='45' cy='25' r='1.5'/%3E%3Ccircle cx='85' cy='25' r='1.5'/%3E%3Ccircle cx='5' cy='45' r='1.5'/%3E%3Ccircle cx='45' cy='45' r='1.5'/%3E%3Ccircle cx='65' cy='45' r='1.5'/%3E%3Ccircle cx='25' cy='65' r='1.5'/%3E%3Ccircle cx='65' cy='65' r='1.5'/%3E%3Ccircle cx='85' cy='65' r='1.5'/%3E%3Ccircle cx='5' cy='85' r='1.5'/%3E%3Ccircle cx='25' cy='85' r='1.5'/%3E%3Ccircle cx='85' cy='85' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`;

  return (
    <div 
      className="min-h-screen bg-white flex text-outline"
      style={{ backgroundImage: pageBackground }}
    >
      {/* Sidebar - Fixed Position */}
      <div className="fixed top-20 left-0 h-[calc(100vh-80px)] z-30 hidden lg:block w-64">
        <Sidebar />
      </div>

      {/* Main Content Area - Pushed right by sidebar width */}
      <div className="flex-1 min-w-0 lg:ml-64">
        <div className="pt-8 pb-12 px-6 lg:px-12 max-w-7xl mx-auto space-y-12">
          
          {/* Header */}
          <div className="flex justify-between items-end">
            <div>
              <div className="inline-block px-4 py-2 bg-white/90 backdrop-blur-sm rounded-2xl mb-4 shadow-sm border border-white/20">
                <h1 className="text-4xl font-normal text-[#2A2B2A] tracking-tight">My Projects</h1>
              </div>
              <div className="inline-block px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-white/20">
                <p className="text-stone-500 text-lg">Manage and showcase your engineering portfolio.</p>
              </div>
            </div>
          </div>

          {/* Content Placeholder */}
          <div className="bg-white rounded-3xl border border-stone-100 p-12 text-center shadow-sm">
             <p className="text-stone-400">Projects content coming soon...</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Projects;

