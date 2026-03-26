"use client"
import React, { useState, useEffect } from 'react';
import { useWeb3React } from '@web3-react/core';
import { fetchMyLogs, fetchLogsByVaultId } from '../lib/blockchain';
import { RefreshCw, Activity, ArrowRight, GitCommit, ArrowLeft } from 'lucide-react';

const HistoryModal = ({ isOpen, onClose }) => {
  const { account, library, active } = useWeb3React();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lineage State
  const [lineageView, setLineageView] = useState(null); // vaultId
  const [lineageLogs, setLineageLogs] = useState([]);
  const [lineageLoading, setLineageLoading] = useState(false);

  const loadLogs = async () => {
    if (!active || !account) return;
    
    setLoading(true);
    setError(null);
    try {
      const fetchedLogs = await fetchMyLogs(library, account);
      // Sort logs by timestamp descending (newest first)
      setLogs([...fetchedLogs].reverse()); 
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch logs from blockchain.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewLineage = async (vaultId) => {
    if (!vaultId || vaultId === 'na') return;
    setLineageView(vaultId);
    setLineageLoading(true);
    setLineageLogs([]);
    try {
        const history = await fetchLogsByVaultId(library, vaultId);
        // Sort oldest first for timeline
        history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        setLineageLogs(history);
    } catch (e) {
        console.error("Lineage fetch error", e);
    } finally {
        setLineageLoading(false);
    }
  };

  const clearLineage = () => {
    setLineageView(null);
    setLineageLogs([]);
  };

  useEffect(() => {
    if (isOpen && active) {
      loadLogs();
      clearLineage();
    }
  }, [isOpen, active, account]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-zinc-200 dark:border-zinc-800">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-orange-500" />
              {lineageView ? 'File Lifecycle Tracking' : 'Blockchain History'}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {lineageView ? `Tracking ID: ${lineageView}` : 'Immutable records stored on Ethereum (Sepolia)'}
            </p>
          </div>
          <div className="flex items-center gap-3">
             {lineageView ? (
                <button 
                  onClick={clearLineage}
                  className="p-2 text-zinc-500 hover:text-orange-500 transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to List
                </button>
             ) : (
                <button 
                  onClick={loadLogs} 
                  className="p-2 text-zinc-500 hover:text-orange-500 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  title="Refresh Logs"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
             )}
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {lineageView ? (
            // LINEAGE VIEW
            <div className="space-y-6">
                {lineageLoading ? (
                    <div className="text-center py-10">Loading timeline...</div>
                ) : lineageLogs.length === 0 ? (
                    <div className="text-center text-zinc-500">No history found for this ID.</div>
                ) : (
                    <div className="relative border-l-2 border-zinc-200 dark:border-zinc-700 ml-4 space-y-8">
                        {lineageLogs.map((log, idx) => (
                            <div key={idx} className="relative pl-6">
                                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full ${log.action === 'Encode' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${log.action === 'Encode' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {log.action}
                                        </span>
                                        <span className="text-xs text-zinc-400">{log.timestamp}</span>
                                    </div>
                                    <div className="text-sm">
                                        <div className="mb-1">
                                          <span className="font-semibold">User:</span>{' '}
                                          {log.userName ? (
                                            <span>
                                              {log.userName}{' '}
                                              <span className="text-xs text-zinc-400">({log.user})</span>
                                            </span>
                                          ) : (
                                            log.user
                                          )}
                                        </div>
                                        <div className="mb-1"><span className="font-semibold">Type:</span> {log.technique}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          ) : (
            // STANDARD TABLE VIEW
            !active ? (
             <div className="text-center py-10 text-zinc-500">
               Please connect your wallet to view history.
             </div>
          ) : loading ? (
             <div className="flex flex-col items-center justify-center py-12">
               <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
               <p className="text-zinc-500">Fetching records from the blockchain...</p>
             </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-center">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p>No history found for this address.</p>
              <p className="text-xs mt-2 opacity-70">Perform steganography operations to create logs.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                    <th className="pb-3 pl-2 font-medium">Action</th>
                    <th className="pb-3 font-medium">Technique</th>
                    <th className="pb-3 font-medium">Data Hash / Text</th>
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium text-right pr-2">Tracking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {logs.map((log, index) => (
                    <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors text-sm">
                      <td className="py-4 pl-2 font-medium text-zinc-900 dark:text-zinc-200">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          log.action.toLowerCase().includes('encode') 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 text-zinc-600 dark:text-zinc-400">
                        {log.technique}
                      </td>
                      <td className="py-4 text-zinc-600 dark:text-zinc-400 font-mono text-xs max-w-xs truncate" title={log.dataHash}>
                         {log.dataHash}
                      </td>
                      <td className="py-4 text-zinc-500 text-xs whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-4 text-right pr-2">
                        {log.vaultId && log.vaultId !== 'na' && (
                            <button 
                                onClick={() => handleViewLineage(log.vaultId)}
                                className="text-orange-500 hover:text-orange-600 text-xs font-medium flex items-center justify-end gap-1 w-full"
                            >
                                <GitCommit className="w-3 h-3" /> View More
                            </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
