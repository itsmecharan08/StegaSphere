"use client";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Play } from "lucide-react";

export default function TutorialsPage() {
  const tutorials = [
    {
      title: "Getting Started with Text Hiding",
      duration: "5 min",
      level: "Beginner",
      description: "Learn the basics of hiding secret messages inside plain text files using zero-width characters."
    },
    {
        title: "Advanced Image Steganography",
        duration: "12 min",
        level: "Intermediate",
        description: "Deep dive into LSB encoding for images and how to maximize capacity without visual distortion."
    },
    {
        title: "Secure Video Embedding",
        duration: "15 min",
        level: "Advanced",
        description: "How to hide data across multiple video frames with custom encryption keys."
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-7xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">Tutorials</h1>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                Step-by-step guides to help you master the art of data concealment.
            </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {tutorials.map((t, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 transition-colors group cursor-pointer">
                    <div className="mb-4 relative h-40 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden">
                        <div className="w-12 h-12 bg-white dark:bg-zinc-700 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 text-blue-600 fill-current ml-1" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium text-zinc-500 mb-2">
                        <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">{t.level}</span>
                        <span>{t.duration}</span>
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t.title}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.description}</p>
                </div>
             ))}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
