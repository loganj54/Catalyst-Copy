import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { UiStateProvider } from './context/UiStateContext';
// import ThemeToggle from './components/ThemeToggle'; // Dormant
import Background from './components/Background';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Career from './pages/Career';
import Skills from './pages/Skills';
import Auth from './pages/Auth';
import Blueprint from './pages/Blueprint';
import Create from './pages/Create';
import ClassDetails from './pages/ClassDetails';

import SidebarNavigation from './components/SidebarNavigation';

function Layout() {
  const location = useLocation();

  // Define routes that should use the Sidebar instead of Navbar
  const sidebarRoutes = ['/classes', '/create', '/blueprint'];
  const isSidebarPage = sidebarRoutes.some(route => location.pathname.startsWith(route)) || location.pathname.startsWith('/class/');

  return (
    <div className={`w-full min-h-screen relative flex flex-col ${isSidebarPage ? '' : 'pt-20'}`}>

      {/* Show Navbar only if NOT a sidebar page */}
      {!isSidebarPage && <Navbar />}

      {/* Show Sidebar only if IS a sidebar page */}
      {isSidebarPage && <SidebarNavigation />}

      {/* Background is handled specifically in Dashboard for sidebar pages, global for others */}
      {!isSidebarPage && <Background />}

      <div className={`${isSidebarPage ? 'pl-16 h-screen overflow-hidden' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/classes" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/projects" element={
            <ProtectedRoute>
              <Projects />
            </ProtectedRoute>
          } />
          <Route path="/career" element={
            <ProtectedRoute>
              <Career />
            </ProtectedRoute>
          } />
          <Route path="/skills" element={
            <ProtectedRoute>
              <Skills />
            </ProtectedRoute>
          } />
          <Route
            path="/create"
            element={
              <ProtectedRoute>
                <Create />
              </ProtectedRoute>
            }
          />
          <Route
            path="/class/:id"
            element={
              <ProtectedRoute>
                <ClassDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/blueprint/:id"
            element={
              <ProtectedRoute>
                <Blueprint />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <UiStateProvider>
          <Router>
            <Layout />
          </Router>
        </UiStateProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
