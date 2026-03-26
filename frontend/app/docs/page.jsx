"use client";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Book, Code, Image, Mic, Video, FileText } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-7xl mx-auto px-4 py-12 w-full">
        <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar */}
            <aside className="w-full md:w-64 flex-shrink-0">
                <div className="sticky top-24 space-y-8">
                    <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">Getting Started</h3>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#intro" className="text-blue-600 dark:text-blue-400 font-medium">Introduction</a></li>
                            <li><a href="#quickstart" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">Quick Start</a></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">Core Modules</h3>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#image" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">Image Steganography</a></li>
                            <li><a href="#audio" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">Audio Steganography</a></li>
                            <li><a href="#video" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">Video Steganography</a></li>
                            <li><a href="#text" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200">Text Steganography</a></li>
                        </ul>
                    </div>
                </div>
            </aside>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="prose dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-6">Documentation</h1>
                    <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8">
                        Learn how to use StegaSphere to hide and retrieve data across multiple media formats securely.
                    </p>

                    <section id="intro" className="mb-12">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            <Book className="w-6 h-6 text-blue-500"/> Introduction
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                            StegaSphere uses advanced algorithms to embed secret data into carrier files (Image, Audio, Video, Text) without noticeably altering the original file.
                        </p>
                    </section>

                    <div className="grid gap-6">
                         <div id="image" className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                                <Image className="w-5 h-5 text-purple-500" /> Image Steganography
                            </h3>
                            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                                Uses Least Significant Bit (LSB) modification to hide data in the pixels of an image. Supports PNG and JPG formats (PNG recommended for lossless).
                            </p>
                            <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-red-500">Supports: .png, .jpg, .jpeg</code>
                        </div>

                        <div id="audio" className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                                <Mic className="w-5 h-5 text-green-500" /> Audio Steganography
                            </h3>
                            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                                Embeds data into the LSBs of audio samples. Best results with WAV files as they are uncompressed.
                            </p>
                             <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-red-500">Supports: .wav</code>
                        </div>

                        <div id="video" className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                                <Video className="w-5 h-5 text-red-500" /> Video Steganography
                            </h3>
                            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                                Hides data in specific frames of a video file. Requires a frame number and an optional encryption key for extraction.
                            </p>
                             <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-red-500">Supports: .mp4, .avi</code>
                        </div>
                         <div id="text" className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-orange-500" /> Text Steganography
                            </h3>
                            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                                Uses Zero-Width Characters (ZWC) to hide binary data within normal text without changing the visual appearance.
                            </p>
                             <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-red-500">Supports: .txt</code>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
