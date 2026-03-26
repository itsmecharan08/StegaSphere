export default function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 bg-black text-white px-4 py-2 rounded-xl shadow-xl">
      <div className="flex items-center gap-3">
        <span className="text-sm">{message}</span>
        <button className="text-xs underline" onClick={onClose}>Dismiss</button>
      </div>
    </div>
  );
}
