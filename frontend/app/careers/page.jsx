"use client";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Briefcase } from "lucide-react";

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-7xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">Join Our Team</h1>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                Help us build the future of privacy and secure communication.
            </p>
        </div>

        <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-zinc-200 dark:border-zinc-800">
             <div className="inline-flex p-4 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 mb-6">
                 <Briefcase className="w-8 h-8" />
             </div>
             <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">No Open Positions</h2>
             <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-lg mx-auto">
                 We currently don't have any open roles, but we're always looking for talented individuals passionate about security and privacy.
             </p>
            <button className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors">
                 Send General Application
            </button>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
