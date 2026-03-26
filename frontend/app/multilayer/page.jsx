"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import FileDrop from "../components/FileDrop";
import ResultPane from "../components/ResultPane";
import { Copy, Check, Upload, ArrowRight, Lock, FileAudio, FileVideo, ArrowLeft, FilePlus, Trash2, Layers } from "lucide-react";

export default function MultilayerPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("encode");
  
  // Encode States
  const [secretText, setSecretText] = useState("");
  // Start with 2 empty carrier slots by default
  const [layers, setLayers] = useState([null, null]); 
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Decode States
  const [decodeFile, setDecodeFile] = useState(null);
  const [decodeLoading, setDecodeLoading] = useState(false);
  const [decodeResult, setDecodeResult] = useState(null);
  const [decodeError, setDecodeError] = useState("");

  // --- Handlers ---

  const handleAddLayer = () => {
    setLayers([...layers, null]);
  };

  const handleRemoveLayer = (index) => {
    const newLayers = [...layers];
    newLayers.splice(index, 1);
    setLayers(newLayers);
  };

  const handleLayerChange = (file, index) => {
      const newLayers = [...layers];
      newLayers[index] = file;
      setLayers(newLayers);
  };

  const handleMultilayerEncode = async () => {
    // Validate: Secret text + at least 1 valid file
    const validLayers = layers.filter(l => l !== null);
    
    if (!secretText || validLayers.length === 0) {
      setError("Please provide Secret Text and at least one Carrier File.");
      return;
    }
    setLoading(true);
    setResult(null);
    setError("");

    const formData = new FormData();
    formData.append("secret_text", secretText);
    
    // Append valid layers dynamically
    validLayers.forEach((file, index) => {
        formData.append(`layer_${index}`, file);
    });

    try {
      // Use Python Backend on Port 5000
      const res = await fetch("http://127.0.0.1:5000/multilayer/encode", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Chain encoding failed.");
      }

      // We expect a file download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Get filename from header - STRICT MODE
      // We trust the backend 100% now.
      let filename = "stego_result.bin"; // Generic fallback
      const disposition = res.headers.get("content-disposition");
      
      if (disposition && disposition.match(/filename="?([^"]+)"?/)) {
        filename = disposition.match(/filename="?([^"]+)"?/)[1];
      } else {
        // Fallback: Check the MIME type of the blob itself
        if (blob.type.includes("video")) filename = "multilayer_result.avi";
        else if (blob.type.includes("audio")) filename = "multilayer_result.wav";
        else if (blob.type.includes("image")) filename = "multilayer_result.png";
        else if (blob.type.includes("text")) filename = "multilayer_result.txt";
      }

      setResult({
        downloadUrl: url,
        fileName: filename,
        message: "Steganography Chain Complete!"
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecode = async () => {
    if (!decodeFile) {
        setDecodeError("Please upload a file to decode.");
        return;
    }
    
    setDecodeLoading(true);
    setDecodeResult(null);
    setDecodeError("");

    const formData = new FormData();
    formData.append("file", decodeFile);
    formData.append("key", "default-key"); // Add the default key for decryption

    try {
        // Always use the intelligent multilayer endpoint
        const endpoint = "http://127.0.0.1:5000/multilayer/decode";
        
        const res = await fetch(endpoint, {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Decoding failed.");
        }

        // Handle multilayer endpoint response (file or text)
        // Check content type to see if it's text or file
        const contentType = res.headers.get("content-type");
        const contentDisposition = res.headers.get("content-disposition");
        
        let filename = "extracted_content";
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            if (match && match[1]) filename = match[1];
        }

        if (contentType && contentType.includes("text/plain")) {
             // It's the final secret text!
             const text = await res.text();
             setDecodeResult({
                 type: 'text',
                 text: text,
                 message: "Final Secret Revealed!"
             });
        } else if (contentType && contentType.includes("application/json")) {
             // Handle case where backend returns text as JSON object (legacy or specific flow)
             const json = await res.json();
             if (json.decoded_text) {
                 setDecodeResult({
                    type: 'text',
                    text: json.decoded_text,
                    message: "Final Secret Revealed!"
                 });
             } else {
                 // It might be an error or weird response
                 throw new Error("Received JSON but no decoded text found.");
             }
        } else {
            // It's an ntermediate file (e.g. wav)
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            setDecodeResult({
                type: 'file',
                downloadUrl: url,
                fileName: filename,
                message: "Hidden Layer Extracted!"
            });
        }
    } catch (err) {
        setDecodeError(err.message);
    } finally {
        setDecodeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pt-20 pb-10 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Back Button */}
        <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => router.back()}
            className="mb-8 flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
        >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
        </motion.button>

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 mb-4">
            Multilayer Steganography
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Create an unbreakable chain of hidden data. Hide text inside Audio, then hide that Audio inside Video.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
            <div className="bg-white dark:bg-zinc-900 p-1 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex gap-1">
                {['encode', 'decode'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab 
                            ? "bg-violet-600 text-white shadow-md" 
                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)} Chain
                    </button>
                ))}
            </div>
        </div>

        <AnimatePresence mode="wait">
            {activeTab === 'encode' ? (
                <motion.div 
                    key="encode"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-8"
                >
                    {/* Step 1: Secret Text */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="text-6xl font-black">1</span>
                        </div>
                        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                             <Lock className="w-5 h-5 text-violet-500"/>
                            Secret Message
                        </h3>
                        <textarea
                            value={secretText}
                            onChange={(e) => setSecretText(e.target.value)}
                            placeholder="Enter the secret text you want to hide deeply..."
                            className="w-full h-32 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 focus:ring-2 focus:ring-violet-500 outline-none resize-none transition-all"
                        />
                    </div>

                    {/* Dynamic Layers */}
                    {layers.map((layerFile, index) => (
                        <React.Fragment key={index}>
                             {/* Arrow connecting previous step to this layer */}
                            <div className="flex justify-center text-zinc-300 dark:text-zinc-700">
                                <ArrowRight className="w-8 h-8 rotate-90 md:rotate-0" />
                            </div>

                            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                                    <span className="text-6xl font-black">{index + 2}</span>
                                </div>
                                
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-semibold flex items-center gap-2">
                                        <Layers className="w-5 h-5 text-blue-500"/>
                                        Carrier Layer {index + 1}
                                    </h3>
                                    {index > 1 && (
                                        <button 
                                            onClick={() => handleRemoveLayer(index)}
                                            className="relative z-10 text-red-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            title="Remove this layer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                
                                <p className="text-sm text-zinc-500 mb-4">
                                    {index === 0 
                                        ? "The secret text will be hidden inside this file." 
                                        : "The previous file will be hidden inside this one."}
                                </p>
                                
                                <FileDrop 
                                    onFile={(f) => handleLayerChange(f, index)} 
                                    label={`Drop Layer ${index + 1} File (Audio, Image, Video)`}
                                />
                                {layerFile && <p className="mt-2 text-sm text-green-600 font-medium">Selected: {layerFile.name}</p>}
                            </div>
                        </React.Fragment>
                    ))}

                    {/* Add Layer Button */}
                    <div className="flex justify-center pt-2">
                        <button
                            onClick={handleAddLayer}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-violet-600 hover:border-violet-500 transition-colors"
                        >
                            <FilePlus className="w-4 h-4" />
                            Add Another Carrier Layer
                        </button>
                    </div>

                    {/* Action */}
                    <div className="flex flex-col items-center gap-4 pt-4">
                        <button
                            onClick={handleMultilayerEncode}
                            disabled={loading}
                            className={`
                                px-8 py-4 rounded-xl font-semibold text-white shadow-lg shadow-violet-500/20 
                                transition-all hover:scale-105 active:scale-95 flex items-center gap-2
                                ${loading ? "bg-zinc-400 cursor-not-allowed" : "bg-gradient-to-r from-violet-600 to-indigo-600"}
                            `}
                        >
                            {loading ? (
                                <>Processing Chain...</> 
                            ) : (
                                <>Start Embedding Chain <Lock className="w-4 h-4" /></>
                            )}
                        </button>
                        
                        {error && (
                            <p className="text-red-500 bg-red-50 dark:bg-red-900/10 px-4 py-2 rounded-lg text-sm">
                                {error}
                            </p>
                        )}
                        
                        {result && (
                            <div className="w-full max-w-md">
                                <ResultPane 
                                    downloadUrl={result.downloadUrl} 
                                    fileName={result.fileName} 
                                    message={result.message}
                                />
                            </div>
                        )}
                    </div>

                </motion.div>
            ) : (
                <motion.div 
                    key="decode"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="max-w-2xl mx-auto space-y-8"
                >
                     <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
                        <h3 className="text-xl font-bold mb-2">Layer-by-Layer Decode</h3>
                        <p className="text-zinc-500 mb-6">
                            Upload your file to extract the hidden content inside it. 
                            <br/>
                            <span className="text-xs text-violet-500">(e.g. Video → Audio, then Audio → Text)</span>
                        </p>
                        
                        <FileDrop onFile={setDecodeFile} label={decodeFile ? decodeFile.name : "Upload Stego File"} />
                        
                        <button
                            onClick={handleDecode}
                            disabled={decodeLoading}
                            className="mt-6 w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:opacity-90 transition-opacity"
                        >
                            {decodeLoading ? "Extracting..." : "Extract Hidden Layer"}
                        </button>

                        {decodeError && (
                            <p className="mt-4 text-red-500 text-sm">{decodeError}</p>
                        )}
                     </div>

                     {decodeResult && (
                         <div className="mt-8">
                             {decodeResult.type === 'text' ? (
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6">
                                    <div className="flex items-center gap-2 mb-4 text-emerald-700 dark:text-emerald-400">
                                        <Check className="w-5 h-5" />
                                        <span className="font-bold">Secret Found!</span>
                                    </div>
                                    <div className="bg-white dark:bg-zinc-950 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900 font-mono text-sm break-all">
                                        {decodeResult.text}
                                    </div>
                                    <button 
                                        onClick={() => navigator.clipboard.writeText(decodeResult.text)}
                                        className="mt-4 text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                                    >
                                        <Copy className="w-3 h-3" /> Copy Text
                                    </button>
                                </div>
                             ) : (
                                 <ResultPane 
                                    downloadUrl={decodeResult.downloadUrl}
                                    fileName={decodeResult.fileName}
                                    message={decodeResult.message}
                                 />
                             )}
                         </div>
                     )}
                </motion.div>
            )}
        </AnimatePresence>

      </div>
    </div>
  );
}
