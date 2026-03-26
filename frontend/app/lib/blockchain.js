import { Web3 } from 'web3';
import StegaSphereLogsABI from './StegaSphereLogsABI.json';

// Get contract address from environment variable or use a fallback for dev/testing
// IMPORTANT: User needs to populate NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

export const getContract = (provider) => {
  if (!CONTRACT_ADDRESS) {
    console.warn("Smart Contract Address not set in environment variables.");
    return null;
  }
  const web3 = new Web3(provider);
  return new web3.eth.Contract(StegaSphereLogsABI, CONTRACT_ADDRESS);
};

const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111

export const switchToSepolia = async (provider) => {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
  } catch (switchError) {
    // This error code indicates that the chain has not been added to MetaMask.
    if (switchError.code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID,
              chainName: 'Sepolia Test Network',
              rpcUrls: ['https://sepolia.infura.io/v3/'], // Or public RPC
              nativeCurrency: {
                name: 'SepoliaETH',
                symbol: 'ETH', // Important: keep as ETH
                decimals: 18,
              },
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            },
          ],
        });
      } catch (addError) {
        console.error("Failed to add Sepolia network", addError);
      }
    } else {
      console.error("Failed to switch to Sepolia network", switchError);
    }
  }
};

export const addLogToBlockchain = async (library, account, userName, action, technique, dataHash, vaultId) => {
  // RELAYER SYSTEM IMPLEMENTATION
  // Instead of triggering MetaMask directly, we send the data to our backend.
  // The backend (Relayer) will sign and pay for the transaction.
  
  if (!account) {
    console.error("No account provided for logging");
    return; 
  }

  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:5000";
    
    // Prepare the payload
    const logData = {
      userWallet: account,
      // If we have a username, we can append it here or let the backend handle the pipe format.
      // The backend expects "action|userWallet" but we can pass userName if we want to preserve that logic.
      // Let's stick to the requested backend logic: action + userWallet.
      // But wait! The previous frontend logic combined action|userName.
      // Let's pass the raw action and let backend append userWallet.
      // OR better: We construct the action string here to be fully explicit.
      // If we pass userName to backend, it might confuse the generic 'relay_log' endpoint.
      // Let's construct a composite user identifier: "UserName (Wallet)"
      // The previous code was: finalAction = `${action}|${safeName}`;
      
      // Let's respect the User Name if it exists, otherwise just Wallet
      action: action, 
      technique: technique,
      dataHash: dataHash,
      vaultId: vaultId || "na",
      // We pass these extra fields for context if needed, but backend uses 'userWallet' param
      // to append to action. 
      // If we want to keep userName in history, we should modify action BEFORE sending.
    };

    // Refined Logic:
    // If userName exists, mix it into action so it's not lost.
    // Backend will then append "|Wallet" to it.
    // Result: "Encode|Sachin|0x123..." -> Very traceable.
    if (userName && userName.trim() !== "") {
       const safeName = userName.replace(/\|/g, "-");
       logData.action = `${action}|${safeName}`;
    }

    console.log(`[Relayer] Sending log to backend:`, logData);

    const response = await fetch(`${API_BASE}/api/log-transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logData),
    });

    const result = await response.json();

    if (!response.ok) {
       console.error("Relayer failed:", result.error);
       // We do not throw/crash here, just log error.
       return null;
    }

    console.log("Log successfully relayed via Backend. TX Hash:", result.tx_hash);
    return result;

  } catch (error) {
    console.error("Error invoking Relayer:", error);
    // Silent fail for UI
  }
};

const parseLog = (log) => {
  // Defensive timestamp parsing
  let timestamp = Date.now() / 1000;
  try {
      const timeVal = log.timestamp || log.time || log[5];
      if (timeVal) {
          timestamp = Number(timeVal);
      }
  } catch (e) {
      console.warn("Timestamp parsing error", e);
  }

  const rawAction = log.action || log[1] || "";
  let action = rawAction;
  let userName = "";

  // Splitting Action and Username safely
  if (rawAction && rawAction.includes("|")) {
      const parts = rawAction.split("|");
      if (parts.length >= 2) {
          action = parts[0];
          userName = parts[1];
      }
  }

  return {
    user: log.user || log[0],
    userName: userName.trim(), // Ensure no whitespace
    action: action,
    technique: log.technique || log[2],
    dataHash: log.dataHash || log[3],
    vaultId: log.vaultId || log[4],
    timestamp: new Date(timestamp * 1000).toLocaleString()
  };
};

export const fetchMyLogs = async (library, account) => {
  if (!library || !account) {
    return [];
  }

  try {
    // Determine if library is a Web3 instance or requires wrapping.
    // In our Web3Provider, library IS a Web3 instance.
    const web3 = library.eth ? library : new Web3(library.currentProvider || library);
    
    // Verify network and contract
    const contract = new web3.eth.Contract(StegaSphereLogsABI, CONTRACT_ADDRESS);
    
    // Debug: Check if contract code exists at address
    // Log environment info to help debugging
    const currentChainId = await web3.eth.getChainId();
    console.log(`[Blockchain Debug] Env Contract Address: ${CONTRACT_ADDRESS}`);
    console.log(`[Blockchain Debug] Current Chain ID: ${currentChainId} (Expected: 11155111)`);

    // Force network switch IF we are definitely on the wrong network
    if (String(currentChainId) !== '11155111') {
      console.warn("Detected wrong network. Attempting to switch to Sepolia...");
      try {
        await switchToSepolia(library.currentProvider || window.ethereum);
        
        // Wait a small delay for provider to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Re-check chain ID
        const newChainId = await web3.eth.getChainId();
        if (String(newChainId) !== '11155111') {
             // If still wrong, let it fail silently or log warning, but do NOT crash app
             console.warn("Network switch incomplete or rejected. Logs may be unavailable.");
             return [];
        }
      } catch (switchErr) {
        console.warn("Network switch failed/rejected by user.", switchErr);
        // Do NOT throw error to UI, simply return empty logs so the app stays functional
        return [];
      }
    }
    
    // Check code at address
    const code = await web3.eth.getCode(CONTRACT_ADDRESS);
    if (code === '0x' || code === '0x0') {
      console.error(`[Blockchain Error] No contract code found at ${CONTRACT_ADDRESS} on chain ${currentChainId}.`);
      throw new Error(`Contract not found at ${CONTRACT_ADDRESS}. Check .env.local`);
    }

    // RELAYER COMPATIBILITY UPDATE:
    // With Relayer, msg.sender is ADMIN, not You. So getMyLogs() returns nothing for you.
    // Fixed Logic: Fetch ALL logs containing your address in the 'action' string.
    // Since we don't have an efficient "search" event, we might have to fetch recent logs 
    // or rely on a different contract method if available.
    // Current Contract assumes standard "allLogs" is restricted or heavy.
    
    // STRATEGY:
    // 1. Try fetching 'getLogs(account)' (The old way - for old entries)
    // 2. Try fetching 'getAllLogs()' (If exists) and filter JS side (Heavy but works)
    // 3. BEST FOR NOW: Since we can't change contract easily, we only see history 
    //    if we can fetch global events.
    
    // WORKAROUND: We will fetch the global "LogAdded" events if the contract emits them.
    // If not, we are limited. Assuming standard array structure:
    
    // Let's try to fetch ALL logs blindly (assuming array length isn't massive yet)
    // IMPORTANT: This requires getAllLogs() function in contract.
    // If not available, we can only see what we paid for (Non-Relayed).
    
    let logs = [];
    try {
        // Attempt to fetch ALL logs (if contract allows) to filter by content string
        // If contract doesn't have getAllLogs, this will fail and we fallback.
        const allLogs = await contract.methods.getAllLogs().call(); 

        if (allLogs && Array.isArray(allLogs)) {
            // STRICT FILTERING: Only return logs where the user actually PERFORMED the action
            const myAccountLower = account.toLowerCase();
            
            logs = allLogs.filter(log => {
                const actionStr = (log.action || log[1] || "");
                
                // STRICT FILTERING: Only include logs where the action string ends with the user's wallet
                // This ensures only the user's relayer transactions are included
                if (actionStr.includes("|")) {
                    const lastPipeIndex = actionStr.lastIndexOf("|");
                    const actorWallet = actionStr.substring(lastPipeIndex + 1).trim().toLowerCase();
                    const myAccountLower = account.toLowerCase();
                    
                    if (actorWallet === myAccountLower && actorWallet.startsWith('0x')) {
                        return true;
                    }
                }
                
                return false;
            });
        }
    } catch (e) {
        // Fallback if getAllLogs not present: Just get my direct logs
        console.warn("Could not fetch global logs (Relayer history might be missing). Check ABI/Contract.", e);
        try {
            logs = await contract.methods.getMyLogs().call({ from: account });
        } catch(directErr) { 
            console.error("Fallback fetch also failed", directErr); 
        }
    }

    console.log("Filtered logs for user:", logs);

    if (!Array.isArray(logs)) {
      console.error("Logs is not an array:", logs);
      return [];
    }
    
    // Format logs for easier consumption
    return logs.map(parseLog);
  } catch (error) {
    console.error("Error fetching logs:", error);
    // Return empty array instead of throwing to avoid UI crash, but log error
    throw new Error(error.message || "Failed to fetch logs");
  }
};

export const fetchLogsByVaultId = async (library, vaultId) => {
  if (!library || !vaultId) return [];

  try {
      const web3 = library.eth ? library : new Web3(library.currentProvider || library);
      const contract = new web3.eth.Contract(StegaSphereLogsABI, CONTRACT_ADDRESS);

      const logs = await contract.methods.getLogsByVaultId(vaultId).call();
      
      return logs.map(parseLog);
  } catch (error) {
      console.error("Error fetching file lineage:", error);
      return [];
  }
};
