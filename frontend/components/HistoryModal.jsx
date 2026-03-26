"use client";
import { useState, useEffect } from "react";
import { useWeb3React } from "@web3-react/core";
import { fetchMyLogs, fetchLogsByVaultId } from "../lib/blockchain";
import { X, History, ChevronRight, Clock, User, FileText, Shield } from "lucide-react";

export default function HistoryModal({ isOpen, onClose }) {
  const { library, account, active } = useWeb3React();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVaultId, setSelectedVaultId] = useState(null);
  const [subLogs, setSubLogs] = useState([]);
  const [subLoading, setSubLoading] = useState(false);

  useEffect(() => {
    if (isOpen && active && account && library) {
      loadMainHistory();
    }
  }, [isOpen, active, account, library]);

  const loadMainHistory = async () => {
    setLoading(true);
    try {
      const userLogs = await fetchMyLogs(library, account);
      setLogs(userLogs);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubHistory = async (vaultId) => {
    if (!vaultId || vaultId === "na") return;
    setSubLoading(true);
    try {
      const lineageLogs = await fetchLogsByVaultId(library, vaultId);
      setSubLogs(lineageLogs);
      setSelectedVaultId(vaultId);
    } catch (error) {
      console.error("Failed to load sub-history:", error);
    } finally {
      setSubLoading(false);
    }
  };

  const handleLogClick = (log) => {
    loadSubHistory(log.vaultId);
  };

  const handleBackToMain = () => {
    setSelectedVaultId(null);
    setSubLogs([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden border border-zinc-200 dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                {selectedVaultId ? "File Lineage" : "Steganography History"}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {selectedVaultId ? `Tracking file: ${selectedVaultId}` : "Your blockchain-verified operations"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {selectedVaultId && (
            <button
              onClick={handleBackToMain}
              className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to Main History
            </button>
          )}

          {loading || subLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
              <span className="ml-3 text-zinc-600 dark:text-zinc-400">
                {loading ? "Loading history..." : "Loading lineage..."}
              </span>
            </div>
          ) : (selectedVaultId ? subLogs : logs).length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
              <p className="text-zinc-600 dark:text-zinc-400">
                {selectedVaultId ? "No lineage data found for this file." : "No history found. Start encoding to see your operations here."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(selectedVaultId ? subLogs : logs).map((log, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedVaultId
                      ? "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
                      : "bg-gradient-to-r from-white to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-md"
                  }`}
                  onClick={() => !selectedVaultId && log.vaultId !== "na" && handleLogClick(log)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg ${
                          log.action === "Encode" 
                            ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        }`}>
                          {log.action === "Encode" ? <Shield className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {log.action}
                        </span>
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          • {log.technique}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {log.userName || "Anonymous"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {log.timestamp}
                        </div>
                      </div>

                      {log.vaultId !== "na" && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-500 font-mono">
                          Vault ID: {log.vaultId}
                        </div>
                      )}
                    </div>

                    {!selectedVaultId && log.vaultId !== "na" && (
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}