import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Classes from './pages/Classes';

function App() {
  return (
    <Router>
      <div className="w-full max-w-7xl bg-white sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-stone-200 relative flex flex-col">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/classes" element={<Classes />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
