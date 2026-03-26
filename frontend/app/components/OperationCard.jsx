export default function OperationCard({ title, description, children, cta }) {
  return (
    <div className="group relative bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-zinc-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-16 h-16 rounded-tl-full bg-blue-500/5 dark:bg-blue-400/10" />
      
      {/* Header section */}
      <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {title}
          </h3>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
            {description}
          </p>
        </div>
        {cta && (
          <div className="flex-shrink-0 mt-1 sm:mt-0">
            {typeof cta === 'string' ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                {cta}
              </span>
            ) : (
              cta
            )}
          </div>
        )}
      </div>
      
      {/* Content section */}
      <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-700/50">
        {children}
      </div>
    </div>
  );
}