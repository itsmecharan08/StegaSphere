"use client";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Newspaper } from "lucide-react";

export default function PressPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-7xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">Press & Media</h1>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                Latest news, press kits, and media resources for StegaSphere.
            </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">Latest News</h3>
                <div className="space-y-6">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 last:border-0 last:pb-0">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 block">Jan 10, 2026</span>
                        <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">StegaSphere Launches Pro Subscription</h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">Unlock unlimited steganography tools with our new Pro tier.</p>
                    </div>
                     <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 last:border-0 last:pb-0">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 block">Dec 15, 2025</span>
                        <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">StegaSphere reaches 10,000 Users</h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">A milestone for our secure community.</p>
                    </div>
                </div>
            </div>

             <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">Media Resources</h3>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                    Download official logos, screenshots, and brand guidelines.
                </p>
                <div className="flex gap-4">
                    <button className="flex-1 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                        Download Logo Kit
                    </button>
                    <button className="flex-1 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                        Brand Guidelines
                    </button>
                </div>
            </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
