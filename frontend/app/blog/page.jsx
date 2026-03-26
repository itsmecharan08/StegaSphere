"use client";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Calendar, User, ArrowRight } from "lucide-react";

export default function BlogPage() {
  const posts = [
    {
      title: "The Art of Invisible Communication",
      excerpt: "Explore the history of steganography from ancient Greece to modern digital techniques.",
      date: "Oct 15, 2025",
      author: "Security Team",
      category: "Education"
    },
    {
        title: "Why AES-256 Encryption Matters",
        excerpt: "Understanding the military-grade encryption that protects your hidden data in StegaSphere.",
        date: "Nov 02, 2025",
        author: "Dev Team",
        category: "Security"
      },
      {
        title: "Protecting Whistleblowers in the Digital Age",
        excerpt: "How steganography provides a vital layer of safety for those speaking truth to power.",
        date: "Dec 10, 2025",
        author: "Editorial",
        category: "Privacy"
      }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-7xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">StegaSphere Blog</h1>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                Insights, updates, and deep dives into the world of steganography and digital privacy.
            </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
                <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-shadow group">
                    <div className="h-48 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <span className="text-4xl">📝</span>
                    </div>
                    <div className="p-6">
                        <div className="flex items-center justify-between text-sm text-zinc-500 mb-4">
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full text-xs font-medium">
                                {post.category}
                            </span>
                            <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{post.date}</span>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                            {post.title}
                        </h3>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-3">
                            {post.excerpt}
                        </p>
                        <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                             <div className="flex items-center gap-2 text-sm text-zinc-500">
                                <User className="w-3 h-3" />
                                <span>{post.author}</span>
                            </div>
                            <button className="text-blue-600 dark:text-blue-400 font-medium text-sm flex items-center gap-1 hover:gap-2 transition-all">
                                Read more <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
