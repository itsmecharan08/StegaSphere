"use client"
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWeb3React } from "@web3-react/core"
import { injected } from '../wallet/Connectors';

export default function ConnectWallet() {
  const { active, account, activate, deactivate } = useWeb3React()
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);

  const connectMetamask = async () => {
    setConnecting(true);
    try {
      await activate(injected)
    } catch (ex) {
      console.log(ex)
      setConnecting(false);
    }
  }

  const disconnect = async () => {
    try {
      deactivate()
      localStorage.removeItem('isWalletConnected');
    } catch (ex) {
      console.log(ex)
    }
  }

  // Update local storage and redirect
  useEffect(() => {
    if (active) {
       localStorage.setItem('isWalletConnected', 'true')
       // Redirect to home after successful connection
       router.push('/');
    }
  }, [active, router])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gradient-to-b from-white to-zinc-100 dark:from-zinc-950 dark:to-black">
      <div className="p-8 bg-white dark:bg-zinc-900 rounded-lg shadow-xl text-center">
          <h1 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">Connect Your Wallet</h1>
          <p className="mb-8 text-zinc-600 dark:text-zinc-400">Connect your MetaMask wallet to continue to the application.</p>
          
          {!active ? (
             <button 
               className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow transition duration-300 flex items-center justify-center mx-auto"
               onClick={connectMetamask}
               disabled={connecting}
             >
               {connecting ? 'Connecting...' : 'Connect to MetaMask'}
             </button>
          ) : (
            <div className="text-center">
                <p className="mb-4 text-green-500 font-semibold">Connected with <b>{account}</b></p>
                <p className="mb-4 text-zinc-500">Redirecting to dashboard...</p>
                 <button className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm opacity-50 hover:opacity-100 transition" onClick={disconnect}>Cancel</button>
            </div>
          )}
      </div>
    </div>
  );
}
