"use client";
import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FileDrop from "../components/FileDrop";
import { FiSearch, FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import { Loader2, Lock, LogIn, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DetectPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // User state
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);

    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:5000";
    const API_M_BASE = process.env.NEXT_PUBLIC_API_M_BASE || "http://localhost:4000";

    // Check user login status
    const checkUserStatus = useCallback(async () => {
        if (status === "loading") return;

        // If Google session exists
        if (session?.user) {
            setUser(session.user);
            setAuthChecked(true);
            return;
        }

        // Check manual login
        try {
            const response = await fetch(`${API_M_BASE}/api/user/me`, {
                credentials: "include",
                headers: { "Cache-Control": "no-cache" },
            });
            if (response.ok) {
                const data = await response.json();
                setUser(data.user || data);
            } else {
                setUser(null);
            }
        } catch (e) {
            setUser(null);
        } finally {
            setAuthChecked(true);
        }
    }, [session, status, API_M_BASE]);

    useEffect(() => {
        checkUserStatus();
    }, [checkUserStatus]);

    const handleFile = (uploadedFile) => {
        setFile(uploadedFile);
        setResult(null);
        setError(null);
    };

    const handleDetect = async () => {
        if (!file) return;

        setLoading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`${API_BASE}/detect`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Detection failed");
            }

            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-900 transition-colors duration-300">
            <Navbar user={user} />
            <main className="flex-grow pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full relative">
                
                {/* Close Button - Top Right of Page */}
                <div className="absolute top-24 right-4 sm:right-6 lg:right-8">
                    <button 
                        onClick={() => router.push('/')}
                        className="p-3 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white transition-all bg-white dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 rounded-full shadow-sm hover:shadow-md border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm"
                        title="Close Detector"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="text-center mb-10 mt-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                        Steganography Detector
                    </h1>
                    <p className="text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto">
                        Drag and drop any file (Image, Audio, Video, Text) to scan for hidden steganographic data.
                        We use our advanced algorithms to detect hidden signatures.
                    </p>
                </div>

                <div className="relative max-w-xl mx-auto rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-visible">
                    
                    {/* Main Content - Blurred if locked */}
                    <div className={`p-8 transition-all duration-300 ${!user ? 'opacity-30 blur-sm pointer-events-none select-none' : ''}`}>
                        <div className="mb-8">
                            <FileDrop onFile={handleFile} />
                        </div>

                        {file && (
                            <div className="text-center mb-6">
                                <p className="text-zinc-700 dark:text-zinc-300 font-medium">Selected: {file.name}</p>
                                <button
                                    onClick={handleDetect}
                                    disabled={loading}
                                    className="mt-4 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 mx-auto shadow-md"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin w-5 h-5" />
                                            Scanning...
                                        </>
                                    ) : (
                                        <>
                                            <FiSearch className="w-5 h-5" />
                                            Scan for Hidden Data
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full">
                                        <FiAlertCircle className="w-5 h-5 text-red-600 dark:text-red-200" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-red-800 dark:text-red-200">Processing Error</h3>
                                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {result && (
                            <div className={`p-6 rounded-xl border ${result.detected ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30'}`}>
                                <div className="flex flex-col items-center text-center space-y-3">
                                    <div className={`p-3 rounded-full ${result.detected ? 'bg-red-100 dark:bg-red-800/30' : 'bg-green-100 dark:bg-green-800/30'}`}>
                                        {result.detected ? (
                                            <FiAlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                                        ) : (
                                            <FiCheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                                        )}
                                    </div>
                                    <h2 className={`text-2xl font-bold ${result.detected ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                                        {result.detected ? "Hidden Data Detected" : "No Hidden Data Found"}
                                    </h2>
                                    <p className="text-zinc-600 dark:text-zinc-300">
                                        {result.message}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Lock Overlay */}
                    {!user && authChecked && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
                            <div className="bg-white dark:bg-zinc-800 p-8 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 text-center max-w-sm transform scale-100 animate-in fade-in zoom-in duration-300">
                                <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
                                    <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Login Required</h3>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-8">
                                    Please login to access the advanced Steganography Detection tools.
                                </p>
                                <button
                                    onClick={() => router.push('/login')}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group"
                                >
                                    <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    Login to Access
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
