"use client";
import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWeb3React } from "@web3-react/core";
import { fetchMyLogs } from "../app/lib/blockchain";

export default function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: "assistant", content: "Hi! I'm the StegaSphere AI assistant. How can I help you today?" }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const { account, library, active } = useWeb3React();
    const [historyContext, setHistoryContext] = useState("");

    // Fetch history when chat opens or account changes
    useEffect(() => {
        const loadHistory = async () => {
            console.log("Chatbot: Attempting to load history...", { active, account });
            if (active && account && library) {
                try {
                    const logs = await fetchMyLogs(library, account);
                    console.log("Chatbot: Fetched logs:", logs);
                    if (logs && logs.length > 0) {
                        // Format logs for the AI
                        const formattedHistory = logs.slice(0, 10).map(log =>
                            `- ${log.action} (${log.technique}) at ${log.timestamp}`
                        ).join("\n");
                        setHistoryContext(`User's Recent Blockchain Activity:\n${formattedHistory}`);
                        console.log("Chatbot: History Context Set:", formattedHistory);
                    } else {
                        console.log("Chatbot: No logs found.");
                        setHistoryContext("");
                    }
                } catch (e) {
                    console.error("Chatbot failed to load history:", e);
                }
            } else {
                console.log("Chatbot: Wallet not connected, skipping history.");
            }
        };

        if (isOpen) {
            loadHistory();
        }
    }, [isOpen, active, account, library]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch("http://127.0.0.1:5000/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: userMessage,
                    history: historyContext
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
            } else {
                setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
            }
        } catch (error) {
            console.error("Chatbot error:", error);
            setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting to the server." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="fixed bottom-6 right-6 z-40">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute bottom-16 right-0 w-[350px] sm:w-[400px] h-[500px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                                        <Bot size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm">StegaSphere AI</h3>
                                        <p className="text-xs text-zinc-500">Powered by Gemini</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-zinc-950">
                                {messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"
                                            }`}
                                    >
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "user"
                                                ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                                }`}
                                        >
                                            {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                                        </div>
                                        <div
                                            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === "user"
                                                ? "bg-blue-600 text-white"
                                                : "bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                                                }`}
                                        >
                                            <div className="whitespace-pre-wrap">
                                                {msg.role === "assistant" ? (
                                                    msg.content.split(/(\*\*.*?\*\*)/g).map((part, i) =>
                                                        part.startsWith('**') && part.endsWith('**')
                                                            ? <strong key={i}>{part.slice(2, -2)}</strong>
                                                            : part
                                                    )
                                                ) : (
                                                    msg.content
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex items-start gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                            <Bot size={16} />
                                        </div>
                                        <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2 flex items-center">
                                            <Loader2 size={16} className="animate-spin text-zinc-500" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                                <form onSubmit={handleSubmit} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Ask about steganography..."
                                        className="flex-1 px-4 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLoading || !input.trim()}
                                        className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Send size={18} />
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                >
                    {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
                </button>
            </div>
        </>
    );
}
