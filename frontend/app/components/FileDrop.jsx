"use client";
import { useCallback, useState } from "react";
import { FiUpload, FiCheck, FiX } from "react-icons/fi";

export default function FileDrop({ accept, onFile }) {
  const [hover, setHover] = useState(false);
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      onFile(f);
    }
  }, [onFile]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      onFile(f);
    }
  };

  const removeFile = () => {
    setFile(null);
    onFile(null);
  };

  return (
    <div
      onDragEnter={() => setIsDragging(true)}
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => {
        setHover(false);
        setIsDragging(false);
      }}
      onDrop={onDrop}
      className={`relative transition-all duration-300 ease-in-out border-3 border-dashed rounded-2xl p-8 text-center 
        ${hover ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10" : "border-zinc-300 dark:border-zinc-600"} 
        ${isDragging ? "scale-105" : "scale-100"} 
        bg-white dark:bg-zinc-800/50 shadow-sm hover:shadow-md`}
    >
      <div className="flex flex-col items-center justify-center space-y-3">
        <div className={`p-4 rounded-full ${file ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30"} transition-colors`}>
          {file ? (
            <FiCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
          ) : (
            <FiUpload className={`w-6 h-6 ${hover ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400"} transition-colors`} />
          )}
        </div>

        {file ? (
          <>
            <div className="w-full max-w-xs truncate font-medium text-zinc-800 dark:text-zinc-200">
              {file.name}
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {(file.size / 1024).toFixed(2)} KB
            </div>
            <button
              onClick={removeFile}
              className="mt-2 flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
            >
              <FiX className="w-4 h-4" /> Remove file
            </button>
          </>
        ) : (
          <>
            <h3 className={`text-lg font-medium ${hover ? "text-blue-600 dark:text-blue-400" : "text-zinc-700 dark:text-zinc-300"} transition-colors`}>
              {isDragging ? "Drop your file here" : "Drag & drop your file"}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {accept ? `Supported formats: ${accept}` : "Any file type supported"}
            </p>
            <div className="mt-4 relative">
              <input
                type="file"
                accept={accept}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="filepick"
                onChange={handleFileChange}
              />
              <label
                htmlFor="filepick"
                className={`inline-flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-all 
                  ${hover ? "bg-blue-600 text-white" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200"} 
                  hover:shadow-md cursor-pointer`}
              >
                Browse files
              </label>
            </div>
          </>
        )}
      </div>
      {isDragging && (
        <div className="absolute inset-0 rounded-2xl border-2 border-blue-400 pointer-events-none animate-pulse"></div>
      )}
    </div>
  );
}