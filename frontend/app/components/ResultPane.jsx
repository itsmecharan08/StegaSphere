export default function ResultPane({ downloadUrl, text, fileName = "result" }) {
  if (!downloadUrl && !text) return null;
  
  return (
    <div className="group relative bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 mt-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 dark:from-blue-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg" />
      
      {text ? (
        <div className="relative">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Extracted Content:
            </span>
            <button 
              onClick={() => navigator.clipboard.writeText(text)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              title="Copy to clipboard"
            >
              Copy
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-sm font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-700/30 p-3 rounded border border-zinc-100 dark:border-zinc-600/50 overflow-x-auto">
            {text}
          </pre>
        </div>
      ) : (
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Your stego file is ready!
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              File will download as: {fileName}
            </p>
          </div>
          <a 
            href={downloadUrl} 
            download={fileName}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-medium transition-all shadow-sm hover:shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        </div>
      )}
    </div>
  );
}