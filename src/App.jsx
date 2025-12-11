import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Classes from './pages/Classes';
import Dashboard from './pages/Dashboard';
import Auth from './pages/Auth';
import Blueprint from './pages/Blueprint';
import ClassDetails from './pages/ClassDetails';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="w-full min-h-screen overflow-hidden relative flex flex-col">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/classes" element={<Classes />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
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
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
