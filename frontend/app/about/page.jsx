"use client";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Shield, Lock, Eye, Users } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-7xl mx-auto px-4 py-12 w-full">
        {/* Hero */}
        <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">About StegaSphere</h1>
            <p className="text-xl text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto">
                We are on a mission to democratize digital privacy through advanced steganography tools accessible to everyone.
            </p>
        </div>

        {/* Mission Stats */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl text-center border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="inline-flex p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4">
                    <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Secure</h3>
                <p className="text-zinc-600 dark:text-zinc-400">Built with military-grade AES-256 encryption standards.</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl text-center border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="inline-flex p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mb-4">
                    <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Private</h3>
                <p className="text-zinc-600 dark:text-zinc-400">Zero-knowledge architecture. We don't see your data.</p>
            </div>
             <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl text-center border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="inline-flex p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-4">
                    <Eye className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Invisible</h3>
                <p className="text-zinc-600 dark:text-zinc-400">Hidden data that withstands statistical analysis.</p>
            </div>
        </div>

        {/* Story */}
        <div className="max-w-3xl mx-auto prose dark:prose-invert">
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-6">Our Story</h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                StegaSphere began as a research project to explore the limits of digital steganography. In an era where digital surveillance is becoming ubiquitous, the ability to communicate privately is more than just a luxury—it's a necessity.
            </p>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                We believe that privacy tools should not be reserved for experts. That's why we built StegaSphere with a focus on user experience, making powerful steganography techniques accessible through a simple browser interface.
            </p>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-12 leading-relaxed">
                Whether you're a journalist protecting a source, a researcher sharing sensitive data, or just someone who values their privacy, StegaSphere is built for you.
            </p>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
