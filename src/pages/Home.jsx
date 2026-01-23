import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Zap, Globe, Shield } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Home = () => {
  return (
    <div
      className="min-h-screen bg-transparent font-sans text-stone-900 relative"
    >

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 text-sm font-medium text-stone-600 dark:text-stone-400 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="flex h-2 w-2 rounded-full bg-[#FF4A1C]"></span>
            Introducing Catalyst Partners
            <ArrowRight className="w-3 h-3 ml-1" />
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl tracking-tight text-stone-900 dark:text-white mb-6 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100 max-w-4xl mx-auto leading-[1.1]">
            <span className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm px-4 rounded-2xl decoration-clone leading-[1.4] box-decoration-clone">
              The learn <span className="text-[#FF4A1C]">engineering</span> app
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-stone-500 dark:text-stone-400 mb-10 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 leading-relaxed">
            <span className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm px-4 py-2 rounded-2xl decoration-clone box-decoration-clone">
              Catalyst is the modern learning platform for engineering students.
              Create study blueprints, track your projects, and master your coursework with AI-powered guidance.
            </span>
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-300">
            <Link
              to="/auth"
              className="w-full sm:w-auto px-6 py-2.5 bg-white dark:bg-stone-900 text-stone-900 dark:text-white border border-stone-300 dark:border-stone-800 rounded-lg font-medium text-base hover:bg-stone-50 dark:hover:bg-stone-800 transition-all shadow-sm"
            >
              Start for free
            </Link>
            <Link
              to="/classes"
              className="w-full sm:w-auto px-6 py-2.5 bg-white dark:bg-stone-900 text-stone-900 dark:text-white border border-stone-300 dark:border-stone-800 rounded-lg font-medium text-base hover:bg-stone-50 dark:hover:bg-stone-800 hover:border-stone-400 transition-all shadow-sm"
            >
              View Classes
            </Link>
          </div>

          {/* Hero Image / Dashboard Preview */}
          <div className="mt-20 relative mx-auto max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
            <div className="rounded-xl bg-stone-100 dark:bg-stone-900 p-2 ring-1 ring-inset ring-stone-900/10 dark:ring-stone-100/10 lg:rounded-2xl lg:p-4 shadow-2xl shadow-stone-200 dark:shadow-none">
              <div className="rounded-lg bg-white dark:bg-stone-800 overflow-hidden aspect-[16/9] border border-stone-200 dark:border-stone-700 relative group">
                {/* Abstract UI Representation */}
                <div className="absolute inset-0 bg-stone-50 dark:bg-stone-800 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-16 h-16 bg-[#FF4A1C]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Zap className="w-8 h-8 text-[#FF4A1C]" />
                    </div>
                    <h3 className="text-lg font-bold text-stone-900 dark:text-white">Your Engineering Dashboard</h3>
                    <p className="text-stone-500 dark:text-stone-400 max-w-sm mx-auto mt-2">
                      Visualize your progress, manage your blueprints, and ace your exams.
                    </p>
                  </div>
                </div>

                {/* Floating Elements (Visual Interest) */}
                <div className="absolute top-10 left-10 w-64 p-4 bg-white dark:bg-stone-900 rounded-xl shadow-lg border border-stone-100 dark:border-stone-800 transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="h-2 w-24 bg-stone-200 dark:bg-stone-700 rounded mb-1"></div>
                      <div className="h-1.5 w-16 bg-stone-100 dark:bg-stone-800 rounded"></div>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded mb-2"></div>
                  <div className="h-2 w-2/3 bg-stone-100 dark:bg-stone-800 rounded"></div>
                </div>

                <div className="absolute bottom-10 right-10 w-64 p-4 bg-white dark:bg-stone-900 rounded-xl shadow-lg border border-stone-100 dark:border-stone-800 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="h-2 w-20 bg-stone-200 dark:bg-stone-700 rounded mb-1"></div>
                      <div className="h-1.5 w-12 bg-stone-100 dark:bg-stone-800 rounded"></div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 flex-1 bg-stone-50 dark:bg-stone-800 rounded border border-stone-100 dark:border-stone-700"></div>
                    <div className="h-8 flex-1 bg-black dark:bg-white rounded"></div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Feature Grid Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-white sm:text-4xl mb-4">
              Everything you need to excel
            </h2>
            <p className="text-lg text-stone-500 dark:text-stone-400 max-w-2xl mx-auto">
              From automated study plans to project tracking, Catalyst gives you the tools to engineer your future.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-3xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-700 transition-colors group">
              <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-2xl border border-stone-300 dark:border-stone-700 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-[#FF4A1C]" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-3">Smart Blueprints</h3>
              <p className="text-stone-500 dark:text-stone-400 leading-relaxed">
                Upload your syllabus or problem sets and let our AI generate a personalized study roadmap for you instantly.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-3xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-700 transition-colors group">
              <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-2xl border border-stone-300 dark:border-stone-700 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-[#FF4A1C]" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-3">Project Tracking</h3>
              <p className="text-stone-500 dark:text-stone-400 leading-relaxed">
                Keep all your engineering projects organized. document your progress, manage assets, and build your portfolio.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-3xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-700 transition-colors group">
              <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-2xl border border-stone-300 dark:border-stone-700 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6 text-[#FF4A1C]" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-3">Resource Library</h3>
              <p className="text-stone-500 dark:text-stone-400 leading-relaxed">
                Access a curated library of engineering resources, videos, and tutorials matched to your specific curriculum.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-stone-300 dark:border-stone-800">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-white sm:text-4xl mb-6">
            Ready to transform your engineering education?
          </h2>
          <p className="text-lg text-stone-500 dark:text-stone-400 mb-10">
            Join thousands of engineering students who are mastering their classes with Catalyst.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/auth"
              className="px-6 py-2.5 bg-white dark:bg-stone-900 text-stone-900 dark:text-white border border-stone-300 dark:border-stone-800 rounded-lg font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-all shadow-sm"
            >
              Get Started for Free
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
