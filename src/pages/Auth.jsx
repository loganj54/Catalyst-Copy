import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn({ email, password });
        if (error) throw error;
        navigate(from, { replace: true });
      } else {
        const { error } = await signUp({ 
          email, 
          password,
          options: {
            data: {
              full_name: email.split('@')[0] // Default name from email
            }
          }
        });
        if (error) throw error;
        // Check if email confirmation is required - usually Supabase defaults to requiring it
        alert('Check your email for the confirmation link!');
      }
    } catch (err) {
      console.error('Signup Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 bg-slate-50 dark:bg-stone-900 transition-colors duration-200">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-stone-800 rounded-xl shadow-lg border border-slate-100 dark:border-stone-700">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-stone-400">
            {isLogin ? 'Sign in to access your classes' : 'Get started with your free account'}
          </p>
        </div>

        {error && (
          <div className="p-4 text-sm text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 border border-red-100 dark:border-red-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-stone-300 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 w-5 h-5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-stone-600 dark:bg-stone-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-stone-400 dark:placeholder:text-stone-500"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-stone-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 w-5 h-5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-stone-600 dark:bg-stone-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-stone-400 dark:placeholder:text-stone-500"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              isLogin ? 'Sign In' : 'Sign Up'
            )}
          </button>
        </form>

        <div className="text-center text-sm">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;

