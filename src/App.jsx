import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
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

function Layout() {
  const location = useLocation();

  return (
    <div className="w-full min-h-screen overflow-hidden relative flex flex-col pt-20">
      <Navbar />
      <ThemeToggle />
      <Background />
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
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Layout />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
