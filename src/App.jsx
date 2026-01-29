import React from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { UiStateProvider } from './context/UiStateContext';

// Pages
import Home from './pages/Home';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Create from './pages/Create';
import CreateBlueprint from './pages/CreateBlueprint';
import Blueprint from './pages/Blueprint';
import Projects from './pages/Projects';
import Career from './pages/Career';
import Skills from './pages/Skills';
import Settings from './pages/Settings';
import ClassDetails from './pages/ClassDetails';

// Components
import Navbar from './components/Navbar';
import SidebarNavigation from './components/SidebarNavigation';
import ProtectedRoute from './components/ProtectedRoute';
import Background from './components/Background';

// Loaders
import { dashboardLoader } from './loaders/dashboardLoader';
import { classDetailsLoader } from './loaders/classDetailsLoader';
import { blueprintLoader } from './loaders/blueprintLoader';
import { createBlueprintLoader } from './loaders/createBlueprintLoader';

// Root Layout Component
const RootLayout = () => {
  const location = useLocation();
  const sidebarRoutes = ['/classes', '/blueprint'];

  // Check if current path starts with any of the sidebarRoutes OR is a specific class page
  // The original logic was: location.pathname.startsWith(route) || location.pathname.startsWith('/class/')
  const isSidebarPage = sidebarRoutes.some(route => location.pathname.startsWith(route)) || location.pathname.startsWith('/class/');

  return (
    <div className={`w-full min-h-screen relative flex flex-col ${isSidebarPage ? 'bg-stone-100 dark:bg-stone-950' : 'pt-20'}`}>

      {/* Show Navbar only if NOT a sidebar page */}
      {!isSidebarPage && <Navbar />}

      {/* Show Sidebar only if IS a sidebar page */}
      {isSidebarPage && <SidebarNavigation />}

      {/* Background is handled specifically in Dashboard for sidebar pages, global for others */}
      {!isSidebarPage && <Background />}

      <div className={`${isSidebarPage ? 'pl-[68px] h-screen overflow-hidden' : ''}`}>
        <Outlet />
      </div>
    </div>
  );
};

// Router Configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Home />
      },
      {
        path: 'auth',
        element: <Auth />
      },
      {
        path: 'dashboard',
        element: <ProtectedRoute><Dashboard /></ProtectedRoute>,
        loader: dashboardLoader
      },
      {
        path: 'classes',
        element: <ProtectedRoute><Dashboard /></ProtectedRoute>,
        loader: dashboardLoader
      },
      {
        path: 'class/:id',
        element: <ProtectedRoute><ClassDetails /></ProtectedRoute>,
        loader: classDetailsLoader
      },
      {
        path: 'create',
        element: <ProtectedRoute><Create /></ProtectedRoute>
      },
      {
        path: 'classes/create',
        element: <ProtectedRoute><CreateBlueprint /></ProtectedRoute>,
        loader: createBlueprintLoader
      },
      {
        path: 'blueprint/:id',
        element: <ProtectedRoute><Blueprint /></ProtectedRoute>,
        loader: blueprintLoader
      },
      {
        path: 'projects',
        element: <ProtectedRoute><Projects /></ProtectedRoute>
      },
      {
        path: 'career',
        element: <ProtectedRoute><Career /></ProtectedRoute>
      },
      {
        path: 'skills',
        element: <ProtectedRoute><Skills /></ProtectedRoute>
      },
      {
        path: 'settings',
        element: <ProtectedRoute><Settings /></ProtectedRoute>
      }
    ]
  }
]);

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <UiStateProvider>
          <RouterProvider router={router} />
        </UiStateProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
