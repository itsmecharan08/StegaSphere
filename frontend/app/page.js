"use client";
import "./globals.css";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { signOut } from "next-auth/react";
import OperationCard from "./components/OperationCard";
import FileDrop from "./components/FileDrop";
import ResultPane from "./components/ResultPane";
import SubscriptionModal from "./components/SubscriptionModal";
import Toast from "./components/Toast";
import { Lock, CheckCircle, LogIn, User, History, Shield, Zap, Eye, FileText, Layers, Monitor } from "lucide-react";
import { useWeb3React } from "@web3-react/core";
import { addLogToBlockchain } from "./lib/blockchain";
import HistoryModal from "./components/HistoryModal";
import { QRCodeSVG } from 'qrcode.react';
import { generateAccessToken, securePayload, unlockPayload } from './lib/secureVault';
import { Copy, X } from 'lucide-react';

export default function Home() {
  const { data: session, status } = useSession();

  // SECURE VAULT STATES
  const [isSecureMode, setIsSecureMode] = useState(false);
  const [secureExpiry, setSecureExpiry] = useState(0); // in hours
  const [lastGeneratedToken, setLastGeneratedToken] = useState("");
  const [showTokenModal, setShowTokenModal] = useState(false);

  const [showDecryptionInput, setShowDecryptionInput] = useState(false);
  const [decryptionToken, setDecryptionToken] = useState("");
  const [pendingDecodedData, setPendingDecodedData] = useState("");

  // File and encoding states
  const [imgFile, setImgFile] = useState(null);
  const [imgSecret, setImgSecret] = useState("");
  const [imgResultUrl, setImgResultUrl] = useState("");
  const [imgDecoded, setImgDecoded] = useState("");
  const [imgMode, setImgMode] = useState("encode");

  const [txtFile, setTxtFile] = useState(null);
  const [txtSecret, setTxtSecret] = useState("");
  const [txtResultUrl, setTxtResultUrl] = useState("");
  const [txtDecoded, setTxtDecoded] = useState("");
  const [txtMode, setTxtMode] = useState("encode");

  const [audioFile, setAudioFile] = useState(null);
  const [audioSecret, setAudioSecret] = useState("");
  const [audioResultUrl, setAudioResultUrl] = useState("");
  const [audioDecoded, setAudioDecoded] = useState("");
  const [audioMode, setAudioMode] = useState("encode");

  const [videoFile, setVideoFile] = useState(null);
  const [videoSecret, setVideoSecret] = useState("");
  const [videoKey, setVideoKey] = useState("");
  const [videoFrameNumber, setVideoFrameNumber] = useState(1);
  const [videoInfo, setVideoInfo] = useState(null);
  const [videoResultUrl, setVideoResultUrl] = useState("");
  const [videoDecoded, setVideoDecoded] = useState("");
  const [videoMode, setVideoMode] = useState("encode");

  // UI states
  const [toast, setToast] = useState("");
  const [isLoading, setIsLoading] = useState({
    imageEncode: false,
    imageDecode: false,
    textEncode: false,
    textDecode: false,
    audioEncode: false,
    audioDecode: false,
    videoEncode: false,
    videoDecode: false,
    imageAnalyze: false,
    textAnalyze: false,
    audioAnalyze: false,
    videoAnalyze: false,
  });

  const [analysisResult, setAnalysisResult] = useState({});
  const [showSubscription, setShowSubscription] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLockedUI, setShowLockedUI] = useState(true);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { account, library, active } = useWeb3React();

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:5000";
  const API_M_BASE = process.env.NEXT_PUBLIC_API_M_BASE || "http://localhost:4000";
  // Use refs for values that shouldn't trigger re-renders
  const userCheckedRef = useRef(false);
  const lastSessionRef = useRef(null);

  const addLogSafe = useCallback((action, technique, dataHash, vId) => {
    if (active && account) {
      const uName = session?.user?.name || user?.username || "Anonymous";
      addLogToBlockchain(library, account, uName, action, technique, dataHash, vId)
        .catch(e => console.error("Blockchain log error:", e));
    }
  }, [active, account, library, session, user]);

  // HELPER: Generate and Parse Stego Payloads
  const createStegoPayload = (secret, walletAddress) => {
    // 1. Create Base Payload
    let vId = null;
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      vId = crypto.randomUUID();
    } else {
      vId = `vid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    const basePayload = { vId, msg: secret, ori: walletAddress, ts: Date.now() };
    let payloadString = JSON.stringify(basePayload);

    // 2. Encryption Wrapper (if secure mode)
    if (isSecureMode) {
      const token = generateAccessToken();
      const hours = parseFloat(secureExpiry); // float support
      // We encrypt the JSON string
      // Note: setLastGeneratedToken MUST be handled by caller or here via side-effect?
      // Side-effects in helper are bad. Return token.
      const encryptedString = securePayload(payloadString, token, hours > 0 ? hours : null, false);
      return { payloadString: encryptedString, vaultId: vId, token };
    }

    return { payloadString, vaultId: vId, token: null };
  };

  const parseStegoPayload = (decodedString) => {
    // 0. Pre-clean
    if (typeof decodedString !== 'string') return { isTracked: false, message: "", vaultId: "na" };
    const cleanStr = decodedString.trim();

    // 1. Check if Encrypted
    // Robust check for start
    if (cleanStr.startsWith('STG-SEC:')) {
      // Stop and ask for token
      return { isTracked: false, isEncrypted: true, raw: cleanStr, message: "🔒 Encrypted Content", vaultId: "na", originalSender: "Unknown" };
    }

    const tryParse = (str) => {
      try {
        const parsed = JSON.parse(str);
        if (parsed && parsed.msg) {
          return { isTracked: true, message: parsed.msg, vaultId: parsed.vId, originalSender: parsed.ori, timestamp: parsed.ts };
        }
      } catch (e) { }
      return null;
    };

    // Attempt 1: Standard Parse
    let result = tryParse(cleanStr);
    if (result) return result;

    // Attempt 2: Repair Truncated JSON (Fixes missing closing brace issues in Text Stego)
    if (cleanStr.startsWith('{')) {
      // Try appending closing brace
      result = tryParse(cleanStr + '}');
      if (result) return result;
      // Try appending quote and brace
      result = tryParse(cleanStr + '"}');
      if (result) return result;
    }

    return { isTracked: false, message: decodedString, vaultId: "na", originalSender: "Unknown" };
  };

  const handleSecureEncodingCompletion = (token) => {
    if (token) {
      setLastGeneratedToken(token);
      setShowTokenModal(true);
    }
  };

  const handleUnlockPayload = () => {
    if (!decryptionToken || !pendingDecodedData) return;

    // Use robust helper
    const result = unlockPayload(pendingDecodedData, decryptionToken);

    if (result.success) {
      // Now parse the inner JSON content
      const final = parseStegoPayload(result.content);

      // Update the UI based on what we decoded
      if (imgMode === 'decode') setImgDecoded(final.message);
      if (txtMode === 'decode') setTxtDecoded(final.message);
      if (audioMode === 'decode') setAudioDecoded(final.message);
      if (videoMode === 'decode') setVideoDecoded(final.message);

      // Log to history if valid
      if (final.isTracked) {
        // Identify the type dynamically based on current mode
        let typeLabel = "Secure Steganography"; // fallback
        if (imgMode === 'decode') typeLabel = "Secure Image Steganography";
        else if (txtMode === 'decode') typeLabel = "Secure Text Steganography";
        else if (audioMode === 'decode') typeLabel = "Secure Audio Steganography";
        else if (videoMode === 'decode') typeLabel = "Secure Video Steganography";

        addLogSafe("Decode", typeLabel, "File Unlocked", final.vaultId);
      }

      setShowDecryptionInput(false);
      setPendingDecodedData("");
      setDecryptionToken("");
      setToast("🔓 Access Granted!");
    } else {
      setToast(result.error || "Decryption failed");
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_M_BASE}/api/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (session) {
        await signOut({ callbackUrl: "/" });
      }

      setUser(null);
      setIsSubscribed(false);
      userCheckedRef.current = false;
      setAuthChecked(false);
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Check user status - FIXED with proper dependencies
  const checkUserStatus = useCallback(
    async (force = false) => {
      // Logic: If explicitly logged out (localStorage empty), do NOT fetch user from backend
      // except if session (Google) exists.
      if (!session && !localStorage.getItem('user')) {
        return { user: null, isSubscribed: false };
      }

      if (status === "loading") {
        return { user: null, isSubscribed: false };
      }

      // Prevent checking multiple times if nothing changed
      const currentSessionId = session?.user?.email || "no-session";
      if (!force && userCheckedRef.current === currentSessionId) {
        return { user, isSubscribed };
      }

      setAuthChecked(true);

      try {
        if (session && session.user?.email) {
          try {
            const response = await fetch(
              `${API_M_BASE}/api/user/check-google`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: session.user.email,
                  name: session.user.name || session.user.email.split("@")[0],
                  image:
                    session.user.image ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      session.user.name || session.user.email
                    )}&background=random`,
                }),
                credentials: "include",
              }
            );

            if (response.ok) {
              const data = await response.json();

              const newUser = {
                ...session.user,
                _id: data.user._id,
                username: data.user.username,
                name:
                  data.user.name ||
                  session.user.name ||
                  session.user.email.split("@")[0],
                email: data.user.email || session.user.email,
                image: data.user.image || session.user.image,
                isGoogle: true,
                isSubscribed: data.hasActiveSubscription,
                subscriptionPlan: data.user.subscriptionPlan,
                hasActiveSubscription: data.hasActiveSubscription,
                ...data.user,
              };

              setUser(newUser);
              setIsSubscribed(data.hasActiveSubscription);
              userCheckedRef.current = currentSessionId;
              return {
                user: newUser,
                isSubscribed: data.hasActiveSubscription,
              };
            } else {
              const newUser = {
                ...session.user,
                isGoogle: true,
                isSubscribed: false,
                hasActiveSubscription: false,
              };
              setUser(newUser);
              setIsSubscribed(false);
              userCheckedRef.current = currentSessionId;
              return { user: newUser, isSubscribed: false };
            }
          } catch (error) {
            const newUser = {
              ...session.user,
              isGoogle: true,
              isSubscribed: false,
              hasActiveSubscription: false,
            };
            setUser(newUser);
            setIsSubscribed(false);
            userCheckedRef.current = currentSessionId;
            return { user: newUser, isSubscribed: false };
          }
        }

        try {
          const response = await fetch(`${API_M_BASE}/api/user/me`, {
            credentials: "include",
            headers: { "Cache-Control": "no-cache" },
          });

          if (response.ok) {
            const data = await response.json();
            const backendUser = data.user || data;
            const newUser = {
              name:
                session?.user?.name ||
                backendUser.username ||
                backendUser.name ||
                backendUser.email,
              email: backendUser.email || session?.user?.email,
              image: session?.user?.image || backendUser.image || null,
              isGoogle: !!session?.user?.image,
              isSubscribed: !!backendUser.hasActiveSubscription,
              subscriptionPlan: backendUser.subscriptionPlan,
              hasActiveSubscription: !!backendUser.hasActiveSubscription,
              ...backendUser,
            };
            setUser(newUser);
            setIsSubscribed(newUser.hasActiveSubscription || false);
            userCheckedRef.current = currentSessionId;
            return {
              user: newUser,
              isSubscribed: newUser.hasActiveSubscription || false,
            };
          } else {
            const fallbackUser = session
              ? {
                ...session.user,
                isSubscribed: false,
                hasActiveSubscription: false,
              }
              : null;
            setUser(fallbackUser);
            setIsSubscribed(false);
            userCheckedRef.current = currentSessionId;
            return { user: fallbackUser, isSubscribed: false };
          }
        } catch (error) {
          const fallbackUser = session
            ? {
              ...session.user,
              isSubscribed: false,
              hasActiveSubscription: false,
            }
            : null;
          setUser(fallbackUser);
          setIsSubscribed(false);
          userCheckedRef.current = currentSessionId;
          return { user: fallbackUser, isSubscribed: false };
        }
      } catch (error) {
        userCheckedRef.current = currentSessionId;
        return { user: null, isSubscribed: false };
      }
    },
    [session, status]
  );

  // Auth check effect - ONLY run when session or status changes
  useEffect(() => {
    if (status === "loading") return;

    const currentSessionId = session?.user?.email || "no-session";
    if (lastSessionRef.current === currentSessionId) return;

    lastSessionRef.current = currentSessionId;

    const checkAuth = async () => {
      try {
        await checkUserStatus();
      } catch (error) {
        setUser(null);
        setIsSubscribed(false);
      }
    };

    checkAuth();
  }, [session, status, checkUserStatus]);

  // Remove fdprocessedid attributes - RUN ONLY ONCE
  useEffect(() => {
    const removeFdProcessedIds = () => {
      const elements = document.querySelectorAll("[fdprocessedid]");
      elements.forEach((el) => {
        el.removeAttribute("fdprocessedid");
      });
    };

    const timer = setTimeout(removeFdProcessedIds, 100);
    return () => clearTimeout(timer);
  }, []);

  // Listen for History Toggle from Navbar
  useEffect(() => {
    const handleOpenHistory = () => setShowHistory(true);
    window.addEventListener('openHistory', handleOpenHistory);
    return () => window.removeEventListener('openHistory', handleOpenHistory);
  }, []);

  // Handle API calls
  const handleApiCall = useCallback(
    async (apiFn, type) => {
      if (!isSubscribed) {
        handleUpgradeClick();
        return;
      }

      setIsLoading((prev) => ({ ...prev, [type]: true }));
      try {
        await apiFn();
      } catch (error) {
        setToast(error.message || "An error occurred. Please try again.");
      } finally {
        setIsLoading((prev) => ({ ...prev, [type]: false }));
      }
    },
    [isSubscribed]
  );

  // Handle upgrade button click with auth check
  const handleUpgradeClick = useCallback(() => {
    if (!user) {
      // Show auth prompt if user is not authenticated
      setShowAuthPrompt(true);
    } else {
      // Show subscription modal if user is authenticated but not subscribed
      setShowSubscription(true);
    }
  }, [user]);

  // Subscription success handler
  const handleSubscriptionSuccess = async (paymentResponse, plan) => {
    try {
      const subscriptionData = {
        plan: plan.id || plan.type,
        paymentId:
          paymentResponse.razorpay_payment_id ||
          paymentResponse.id ||
          `pay_${Date.now()}`,
        amount: plan.price || plan.amount || (plan.id === "1year" ? 2999 : 299),
        currency: plan.currency || "INR",
        period: plan.period || (plan.id === "1year" ? "yearly" : "monthly"),
      };

      const updateResponse = await fetch(
        `${API_M_BASE}/api/user/subscription`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(subscriptionData),
          credentials: "include",
        }
      );

      const responseData = await updateResponse.json();

      if (updateResponse.ok) {
        setIsSubscribed(true);

        setUser((prev) => {
          if (!prev) {
            if (session) {
              return {
                name: session.user?.name || session.user?.email,
                email: session.user?.email,
                image: session.user?.image,
                isGoogle: true,
                isSubscribed: true,
                subscriptionPlan: subscriptionData.plan,
                subscriptionStart: new Date().toISOString(),
                hasActiveSubscription: true,
              };
            }
            return null;
          }

          return {
            ...prev,
            isSubscribed: true,
            subscriptionPlan: subscriptionData.plan,
            subscriptionStart: new Date().toISOString(),
            hasActiveSubscription: true,
          };
        });

        setShowSubscription(false);
        setToast(
          `🎉 Welcome to StegaSphere Pro! ${subscriptionData.period}ly plan activated.`
        );

        // Animate unlock
        setShowLockedUI(false);

        setTimeout(() => {
          const toolsSection = document.getElementById("tools");
          if (toolsSection) {
            toolsSection.scrollIntoView({ behavior: "smooth" });
          }
        }, 1000);

        return { success: true, data: responseData };
      } else {
        const errorMessage =
          responseData.message || "Failed to update subscription in database";
        throw new Error(errorMessage);
      }
    } catch (error) {
      let toastMessage =
        "Payment successful, but failed to activate subscription. ";

      if (error.message.includes("already have an active subscription")) {
        toastMessage = "You already have an active subscription!";
      } else if (
        error.message.includes("network") ||
        error.message.includes("Failed to fetch")
      ) {
        toastMessage +=
          "Please check your internet connection and refresh the page.";
      } else {
        toastMessage += "Please contact support or refresh the page.";
      }

      setToast(toastMessage);
      setShowSubscription(false);

      return { success: false, error: error.message };
    }
  };

  const handleStartEncoding = useCallback(() => {
    if (!isSubscribed) {
      handleUpgradeClick();
    } else {
      document.getElementById("tools")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isSubscribed, handleUpgradeClick]);

  // Video file selection - STABLE
  const handleVideoFileSelect = useCallback(async (file) => {
    if (!file || !(file instanceof File)) {
      setToast("Invalid video file selected");
      return;
    }

    setVideoFile(file);
    setVideoInfo(null);

    // Load metadata for both encode and decode modes
    try {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        const fps = 30;
        const totalFrames = Math.floor(video.duration * fps);

        setVideoInfo({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          totalFrames: totalFrames,
        });

        const defaultFrame = Math.floor(totalFrames / 2) || 1;
        setVideoFrameNumber(defaultFrame > 0 ? defaultFrame : 1);
        URL.revokeObjectURL(video.src); // Clean up
      };

      video.onerror = () => {
        setToast("Could not load video metadata. Please try another file.");
        URL.revokeObjectURL(video.src); // Clean up
      };
    } catch (error) {
      setToast("Error processing video file");
    }
  }, []);

  // Encoding/Decoding functions - Memoized

  const encodeImage = useCallback(async () => {
    if (!imgFile || !imgSecret) {
      setToast("Add an image and a secret");
      return;
    }

    // NEW: Wrapper
    const { payloadString, vaultId, token } = createStegoPayload(imgSecret, account);

    const fd = new FormData();
    fd.append("image", imgFile);
    fd.append("text", payloadString);

    const r = await fetch(`${API_BASE}/image/encode`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) {
      let errMsg = "Image encoding failed";
      try { const errorData = await r.json(); errMsg = errorData.error || errMsg; } catch (e) { }
      throw new Error(errMsg);
    }
    const blob = await r.blob();
    setImgResultUrl(URL.createObjectURL(blob));
    setImgDecoded("");
    setToast("Image encoded successfully!");

    handleSecureEncodingCompletion(token);

    // Blockchain Log
    addLogSafe("Encode", token ? "Secure Image Steganography" : "Image Steganography", imgSecret, vaultId);
  }, [imgFile, imgSecret, active, account, library, isSecureMode, secureExpiry]);

  const decodeImage = useCallback(async () => {
    if (!imgFile) {
      setToast("Add an image");
      return;
    }
    const fd = new FormData();
    fd.append("image", imgFile);
    const r = await fetch(`${API_BASE}/image/decode`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) {
      let errMsg = "Image decoding failed";
      try { const errorData = await r.json(); errMsg = errorData.error || errMsg; } catch (e) { }
      throw new Error(errMsg);
    }
    const { decoded_text } = await r.json();

    // NEW: Unwrap
    const result = parseStegoPayload(decoded_text);

    if (result.isEncrypted) {
      setPendingDecodedData(result.raw);
      setShowDecryptionInput(true);
      setImgDecoded("🔒 Secure Content - Token Required");
      setToast("🔒 Secure File Detected");
      return;
    }

    setImgDecoded(result.message || "(no message found)");
    setImgResultUrl("");
    setToast("Image decoded successfully!");
    // Blockchain Log
    if (result.isTracked) {
      addLogSafe("Decode", "Image Steganography", "Decoded Content", result.vaultId);
    }
  }, [imgFile, active, account, library]);

  const analyzeGeneric = useCallback(
    async (kind) => {
      let file = null;
      let secret = "";
      const fd = new FormData();

      if (kind === "image") {
        file = imgFile;
        secret = imgSecret;
        fd.append("image", file);
        fd.append("text", secret);
      } else if (kind === "text") {
        file = txtFile;
        secret = txtSecret;
        fd.append("file", file);
        fd.append("text", secret);
      } else if (kind === "audio") {
        file = audioFile;
        secret = audioSecret;
        fd.append("audio", file);
        fd.append("text", secret);
      } else if (kind === "video") {
        file = videoFile;
        secret = videoSecret;
        fd.append("video", file);
        fd.append("text", secret);
        fd.append("frame_number", videoFrameNumber.toString());
        fd.append("key", videoKey || "");
      }

      if (!file || (kind !== "video" && !secret)) {
        setToast("Add a cover file and the secret message before analysis");
        return;
      }

      const flagKey = `${kind}Analyze`;
      setIsLoading((prev) => ({ ...prev, [flagKey]: true }));

      try {
        const r = await fetch(`${API_BASE}/analyze`, {
          method: "POST",
          body: fd,
          signal: AbortSignal.timeout(30000),
        });

        if (!r.ok) {
          const errorText = await r.text();
          let errorData = {};
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            throw new Error(errorText || `Server error: ${r.status}`);
          }
          throw new Error(errorData.error || "Analysis failed");
        }

        const data = await r.json();
        setAnalysisResult((prev) => ({ ...prev, [kind]: data }));
        setToast("Analysis complete!");
      } catch (error) {
        console.error("Analysis error:", error);

        if (error.name === "AbortError") {
          setToast("Analysis timed out. Please try again.");
        } else if (error.message.includes("Failed to fetch")) {
          setToast(
            "Cannot connect to server. Make sure the backend is running on port 5000."
          );
        } else {
          setToast(error.message || "Analysis failed. Please try again.");
        }
      } finally {
        setIsLoading((prev) => ({ ...prev, [flagKey]: false }));
      }
    },
    [
      imgFile,
      imgSecret,
      txtFile,
      txtSecret,
      audioFile,
      audioSecret,
      videoFile,
      videoSecret,
      videoFrameNumber,
      videoKey,
    ]
  );

  const encodeText = useCallback(async () => {
    if (!txtFile || !txtSecret) {
      setToast("Add a text cover and a secret");
      return;
    }

    // NEW: Wrapper
    const { payloadString, vaultId, token } = createStegoPayload(txtSecret, account);

    const fd = new FormData();
    fd.append("file", txtFile);
    fd.append("text", payloadString); // Send JSON

    const r = await fetch(`${API_BASE}/text/encode`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) {
      let errMsg = "Text encoding failed";
      try { const errorData = await r.json(); errMsg = errorData.error || errMsg; } catch (e) { }
      throw new Error(errMsg);
    }
    const blob = await r.blob();
    setTxtResultUrl(URL.createObjectURL(blob));
    setTxtDecoded("");
    setToast("Text encoded successfully!");

    handleSecureEncodingCompletion(token);

    // Blockchain Log
    addLogSafe("Encode", token ? "Secure Text Steganography" : "Text Steganography", txtSecret, vaultId);
  }, [txtFile, txtSecret, active, account, library, isSecureMode, secureExpiry]);

  const decodeText = useCallback(async () => {
    if (!txtFile) {
      setToast("Add a stego text file");
      return;
    }
    const fd = new FormData();
    fd.append("file", txtFile);
    const r = await fetch(`${API_BASE}/text/decode`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) {
      let errMsg = "Text decoding failed";
      try { const errorData = await r.json(); errMsg = errorData.error || errMsg; } catch (e) { }
      throw new Error(errMsg);
    }
    const { decoded_text } = await r.json();

    // NEW: Unwrap
    const result = parseStegoPayload(decoded_text);

    if (result.isEncrypted) {
      setPendingDecodedData(result.raw);
      setShowDecryptionInput(true);
      setTxtDecoded("🔒 Secure Content - Token Required");
      setToast("🔒 Secure File Detected");
      return;
    }

    setTxtDecoded(result.message || "(no message found)");
    setTxtResultUrl("");
    setToast("Text decoded successfully!");
    // Blockchain Log
    if (result.isTracked) {
      addLogSafe("Decode", "Text Steganography", "Decoded Content", result.vaultId);
    }
  }, [txtFile, active, account, library]);

  const encodeAudio = useCallback(async () => {
    if (!audioFile || !audioSecret) {
      setToast("Add an audio file and a secret");
      return;
    }

    // NEW: Wrapper
    const { payloadString, vaultId, token } = createStegoPayload(audioSecret, account);

    const fd = new FormData();
    fd.append("audio", audioFile);
    fd.append("text", payloadString); // Send JSON

    const r = await fetch(`${API_BASE}/audio/encode`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) {
      let errMsg = "Audio encoding failed";
      try { const errorData = await r.json(); errMsg = errorData.error || errMsg; } catch (e) { }
      throw new Error(errMsg);
    }
    const blob = await r.blob();
    setAudioResultUrl(URL.createObjectURL(blob));
    setAudioDecoded("");
    setToast("Audio encoded successfully!");

    handleSecureEncodingCompletion(token);

    // Blockchain Log
    addLogSafe("Encode", token ? "Secure Audio Steganography" : "Audio Steganography", audioSecret, vaultId);
  }, [audioFile, audioSecret, active, account, library, isSecureMode, secureExpiry]);

  const decodeAudio = useCallback(async () => {
    if (!audioFile) {
      setToast("Add an audio file");
      return;
    }
    const fd = new FormData();
    fd.append("audio", audioFile);
    const r = await fetch(`${API_BASE}/audio/decode`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) {
      let errMsg = "Audio decoding failed";
      try { const errorData = await r.json(); errMsg = errorData.error || errMsg; } catch (e) { }
      throw new Error(errMsg);
    }
    const { decoded_text } = await r.json();

    // NEW: Unwrap
    const result = parseStegoPayload(decoded_text);

    if (result.isEncrypted) {
      setPendingDecodedData(result.raw);
      setShowDecryptionInput(true);
      setAudioDecoded("🔒 Secure Content - Token Required");
      setToast("🔒 Secure File Detected");
      return;
    }

    setAudioDecoded(result.message || "(no message found)");
    setAudioResultUrl("");
    setToast("Audio decoded successfully!");
    // Blockchain Log
    if (result.isTracked) {
      addLogSafe("Decode", "Audio Steganography", "Decoded Content", result.vaultId);
    }
  }, [audioFile, active, account, library]);

  const encodeVideo = useCallback(async () => {
    if (!videoFile || !videoSecret) {
      setToast("Add a video file and a secret");
      return;
    }
    try {

      // NEW: Wrapper
      const { payloadString, vaultId, token } = createStegoPayload(videoSecret, account);

      const fd = new FormData();
      fd.append("video", videoFile);
      fd.append("text", payloadString); // Send JSON
      fd.append("key", videoKey);
      fd.append("frame_number", videoFrameNumber.toString());

      const r = await fetch(`${API_BASE}/video/encode`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        let errMsg = "Video encoding failed";
        try { const errorData = await r.json(); errMsg = errorData.error || errMsg; } catch (e) { }
        throw new Error(errMsg);
      }
      const blob = await r.blob();
      setVideoResultUrl(URL.createObjectURL(blob));
      setVideoDecoded("");
      setToast("Video encoded successfully!");

      handleSecureEncodingCompletion(token);

      // Blockchain Log
      addLogSafe("Encode", token ? "Secure Video Steganography" : "Video Steganography", videoSecret, vaultId);

    } catch (error) {
      console.error("Video encoding error:", error);
      setToast(
        error.message ||
        "Video encoding failed. Please try a different file or frame."
      );
      // throw error; 
    }
  }, [
    videoFile,
    videoSecret,
    videoKey,
    videoFrameNumber,
    active,
    account,
    library,
    isSecureMode,
    secureExpiry
  ]);

  const decodeVideo = useCallback(async () => {
    if (!videoFile) {
      setToast("Add a video file");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("video", videoFile);
      fd.append("key", videoKey);
      fd.append("frame_number", videoFrameNumber.toString());

      const r = await fetch(`${API_BASE}/video/decode`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        let errMsg = "Video decoding failed";
        try { const errorData = await r.json(); errMsg = errorData.error || errMsg; } catch (e) { }
        throw new Error(errMsg);
      }
      const { decoded_text } = await r.json();

      // NEW: Unwrap
      const result = parseStegoPayload(decoded_text);

      if (result.isEncrypted) {
        setPendingDecodedData(result.raw);
        setShowDecryptionInput(true);
        setVideoDecoded("🔒 Secure Content - Token Required");
        setToast("🔒 Secure File Detected");
        return;
      }

      setVideoDecoded(result.message || "(no message found)");
      setVideoResultUrl("");
      setToast("Video decoded successfully!");
      // Blockchain Log
      if (result.isTracked) {
        addLogSafe("Decode", "Video Steganography", "Decoded Content", result.vaultId);
      }
    } catch (error) {
      console.error("Video decoding error:", error);
      setToast(error.message || "Video decoding failed");
    }
  }, [videoFile, videoKey, videoFrameNumber, active, account, library]);

  function formatScore(raw) {
    if (raw == null || raw === "") return "N/A";
    const n = Number(raw);
    if (Number.isNaN(n)) return String(raw);
    let percent = n;
    if (n <= 1) percent = n * 100;
    percent = Math.max(0, Math.min(100, percent));
    return Math.round(percent * 100) / 100 + "%";
  }

  function AnalysisBox({ kind }) {
    const res = analysisResult?.[kind];
    if (!res) return null;
    const score = formatScore(res.score);
    return (
      <div className="mt-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-700">
        <p className="font-semibold">{"Analysis Results:"}</p>
        <p>
          <strong>{"Score:"}</strong> {score}
        </p>
        <p>
          <strong>{"Fits:"}</strong> {res.fits ? "Yes" : "No"}
        </p>
        {res.reasons && (
          <ul className="list-disc ml-5 text-sm mt-2">
            {res.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
        {res.advice && (
          <p className="text-sm mt-2 text-blue-600 dark:text-blue-400">
            {res.advice}
          </p>
        )}
      </div>
    );
  }

  // Lock overlay component for content area only - MEMOIZED
  const LockedContent = useCallback(
    ({ children, onClick }) => {
      if (isSubscribed) {
        return <div className="space-y-4">{children}</div>;
      }

      return (
        <div className="relative min-h-[400px]">
          {/* Original content with reduced opacity */}
          <div className="space-y-4 opacity-30 pointer-events-none">
            {children}
          </div>

          {/* Lock overlay positioned in the middle of the content area */}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6">
            <div className="w-full bg-gradient-to-br from-white/90 to-white/70 dark:from-zinc-900/90 dark:to-zinc-800/70 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/30 dark:border-zinc-700/30">
              <div className="flex flex-col items-center text-center">
                {/* Lock icon */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-xl opacity-30"></div>
                  <div className="relative bg-gradient-to-br from-white to-zinc-100 dark:from-zinc-800 dark:to-zinc-900 p-5 rounded-2xl shadow-lg">
                    <Lock className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>

                {/* Text content */}
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">
                  {"Pro Feature Locked"}
                </h3>

                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                  {
                    "Upgrade to StegaSphere Pro to unlock advanced steganography tools with unlimited access"
                  }
                </p>

                {/* Upgrade button */}
                <button
                  onClick={onClick}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 group"
                >
                  <Lock className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  {"Upgrade to Unlock"}
                  <span className="ml-1 px-2 py-1 text-xs bg-white/20 rounded-full">
                    {"PRO"}
                  </span>
                </button>

                {/* Features list */}
                <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>{"Unlimited encodes & decodes"}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>{"Advanced analysis tools"}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>{"Priority support"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    },
    [isSubscribed]
  );

  // Authentication Prompt Modal - MEMOIZED
  const AuthPromptModal = useCallback(() => {
    if (!showAuthPrompt) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAuthPrompt(false)}
        />

        {/* Modal */}
        <div className="relative w-full max-w-md bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-200 dark:border-zinc-700 animate-in zoom-in-95 duration-300">
          {/* Close button */}
          <button
            onClick={() => setShowAuthPrompt(false)}
            className="absolute top-4 right-4 p-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <div className="text-center">
            {/* Icon */}
            <div className="mb-6">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg">
                <LogIn className="w-12 h-12" />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
              {"Sign In Required"}
            </h3>

            {/* Description */}
            <p className="text-zinc-600 dark:text-zinc-400 mb-8">
              {
                "You need to sign in to your account to upgrade to StegaSphere Pro and access premium features."
              }
            </p>

            {/* Login options */}
            <div className="space-y-4">
              <a
                href="/login"
                className="block px-6 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-3 group"
              >
                <LogIn className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {"Sign In to Continue"}
              </a>

              <a
                href="/register"
                className="block px-6 py-4 rounded-xl border-2 border-zinc-300 dark:border-zinc-600 bg-white/50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors backdrop-blur-sm"
              >
                {"Create New Account"}
              </a>
            </div>

            {/* Benefits */}
            <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                {"Benefits of creating an account:"}
              </h4>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{"Save your encoding/decoding history"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{"Access your files across devices"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{"Upgrade to Pro for unlimited access"}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }, [showAuthPrompt]);

  const currentUser =
    user ||
    (session
      ? {
        name: session.user?.name || session.user?.email,
        email: session.user?.email,
        image: session.user?.image,
        isGoogle: true,
        isSubscribed: false,
      }
      : null);

  // Fix file inputs by using stable handlers
  const handleImgFileSelect = useCallback((file) => {
    setImgFile(file);
  }, []);

  const handleTxtFileSelect = useCallback((file) => {
    setTxtFile(file);
  }, []);

  const handleAudioFileSelect = useCallback((file) => {
    setAudioFile(file);
  }, []);

  // Stable text change handlers
  const handleImgSecretChange = useCallback((e) => {
    setImgSecret(e.target.value);
  }, []);

  const handleTxtSecretChange = useCallback((e) => {
    setTxtSecret(e.target.value);
  }, []);

  const handleAudioSecretChange = useCallback((e) => {
    setAudioSecret(e.target.value);
  }, []);

  const handleVideoSecretChange = useCallback((e) => {
    setVideoSecret(e.target.value);
  }, []);

  const handleVideoKeyChange = useCallback((e) => {
    setVideoKey(e.target.value);
  }, []);

  const handleVideoFrameChange = useCallback((e) => {
    setVideoFrameNumber(parseInt(e.target.value) || 1);
  }, []);

  // Stable mode change handlers
  const handleImgModeChange = useCallback(
    (mode) => () => {
      setImgMode(mode);
    },
    []
  );

  const handleTxtModeChange = useCallback(
    (mode) => () => {
      setTxtMode(mode);
    },
    []
  );

  const handleAudioModeChange = useCallback(
    (mode) => () => {
      setAudioMode(mode);
    },
    []
  );

  const handleVideoModeChange = useCallback(
    (mode) => () => {
      setVideoMode(mode);
    },
    []
  );

  // Secure Options UI Component
  const RenderSecureOptions = () => (
    <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Secure Vault</h3>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isSecureMode}
            onChange={(e) => setIsSecureMode(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Enable Encryption & Token Access
          </span>
        </label>

        {isSecureMode && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Link Expiry (Hours)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0 = No Expiry"
                value={secureExpiry}
                onChange={(e) => setSecureExpiry(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs text-zinc-500 self-end mb-2">
              0 = Forever
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950">
      <Navbar
        user={currentUser}
        isSubscribed={isSubscribed}
        onLogout={handleLogout}
      />

      <main className="pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="mt-8 bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-8 shadow-lg border border-zinc-200 dark:border-zinc-700">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent pb-1">
                {"StegaSphere"}
              </h1>
              {isSubscribed && (
                <span className="px-3 py-1.5 text-sm font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full shadow-md transform hover:scale-105 transition-transform">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    {"PRO ACTIVE"}
                  </span>
                </span>
              )}
            </div>
            <p className="text-base md:text-lg text-zinc-600 dark:text-zinc-400 mt-4">
              {isSubscribed
                ? "Welcome back! Enjoy unlimited access to all steganography tools with enhanced security."
                : "Hide & retrieve data inside images, text, audio, and video with military-grade encryption."}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={handleStartEncoding}
                className="px-6 py-3 md:px-8 md:py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-3 group"
              >
                {isSubscribed ? (
                  <>
                    <span className="text-base md:text-lg">{"Start Encoding"}</span>
                    <svg
                      className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    <span className="text-base md:text-lg">
                      {"Get Started - Subscribe Now"}
                    </span>
                  </>
                )}
              </button>
              {!isSubscribed && (
                <a
                  href="#features"
                  className="px-6 py-3 md:px-8 md:py-4 rounded-xl border-2 border-zinc-300 dark:border-zinc-600 bg-white/50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors backdrop-blur-sm"
                >
                  {"Learn How It Works"}
                </a>
              )}
            </div>

            {!isSubscribed && (
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-blue-800 dark:text-blue-300">
                    <span className="font-semibold">
                      {"Start with 3 free encodes."}
                    </span>{" "}
                    {"Unlimited access starts at ₹299/month"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Tools Section */}
        <section id="tools" className="mt-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
                {"Steganography Tools"}
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                {isSubscribed
                  ? "All tools unlocked and ready to use"
                  : "Upgrade to Pro for full access to all features"}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Image Card */}
            <OperationCard
              title="Image Steganography"
              description="PNG/JPG via LSB. Paste your secret and get a stego image; or upload one to extract."
              cta={
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                  {"LSB • Lossless PNG preferred"}
                </span>
              }
            >
              <LockedContent onClick={handleUpgradeClick}>
                <div className="space-y-4">
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={handleImgModeChange("encode")}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${imgMode === "encode"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                        }`}
                    >
                      {"Encode"}
                    </button>
                    <button
                      onClick={handleImgModeChange("decode")}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${imgMode === "decode"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                        }`}
                    >
                      {"Decode"}
                    </button>
                  </div>

                  <FileDrop accept="image/*" onFile={handleImgFileSelect} />

                  {imgMode === "encode" && imgFile && (
                    <textarea
                      placeholder="Enter secret message to embed..."
                      value={imgSecret}
                      onChange={handleImgSecretChange}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] transition-all duration-300"
                    />
                  )}

                  {imgMode === "encode" && imgFile && <RenderSecureOptions />}

                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        handleApiCall(
                          imgMode === "encode" ? encodeImage : decodeImage,
                          imgMode === "encode" ? "imageEncode" : "imageDecode"
                        )
                      }
                      disabled={
                        isLoading.imageEncode ||
                        isLoading.imageDecode ||
                        !imgFile ||
                        (imgMode === "encode" && !imgSecret)
                      }
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                    >
                      {isLoading.imageEncode || isLoading.imageDecode ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          {imgMode === "encode" ? "Encoding..." : "Decoding..."}
                        </span>
                      ) : imgMode === "encode" ? (
                        "Encode"
                      ) : (
                        "Decode"
                      )}
                    </button>

                    {imgMode === "encode" && (
                      <button
                        onClick={() =>
                          handleApiCall(
                            () => analyzeGeneric("image"),
                            "imageAnalyze"
                          )
                        }
                        disabled={
                          isLoading.imageAnalyze || !imgFile || !imgSecret
                        }
                        className="px-4 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                      >
                        {isLoading.imageAnalyze ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            {"Analyzing..."}
                          </span>
                        ) : (
                          "Analyze"
                        )}
                      </button>
                    )}
                  </div>

                  <AnalysisBox kind="image" />

                  <ResultPane
                    downloadUrl={imgResultUrl}
                    text={imgDecoded}
                    fileName="stego-image.png"
                    type={imgMode === "encode" ? "download" : "text"}
                  />
                </div>
              </LockedContent>
            </OperationCard>

            {/* Text Card */}
            <OperationCard
              title="Text Steganography"
              description="Zero-width chars inside a text cover file. Upload a .txt cover to embed or a stego .txt to extract."
              cta={
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200">
                  {"ZWC • Terminator marker"}
                </span>
              }
            >
              <LockedContent onClick={handleUpgradeClick}>
                <div className="space-y-4">
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={handleTxtModeChange("encode")}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${txtMode === "encode"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                        }`}
                    >
                      {"Encode"}
                    </button>
                    <button
                      onClick={handleTxtModeChange("decode")}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${txtMode === "decode"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                        }`}
                    >
                      {"Decode"}
                    </button>
                  </div>

                  <FileDrop accept=".txt" onFile={handleTxtFileSelect} />

                  {txtMode === "encode" && txtFile && (
                    <textarea
                      placeholder="Enter secret message to embed..."
                      value={txtSecret}
                      onChange={handleTxtSecretChange}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] transition-all duration-300"
                    />
                  )}

                  {txtMode === "encode" && txtFile && <RenderSecureOptions />}

                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        handleApiCall(
                          txtMode === "encode" ? encodeText : decodeText,
                          txtMode === "encode" ? "textEncode" : "textDecode"
                        )
                      }
                      disabled={
                        isLoading.textEncode ||
                        isLoading.textDecode ||
                        !txtFile ||
                        (txtMode === "encode" && !txtSecret)
                      }
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                    >
                      {isLoading.textEncode || isLoading.textDecode ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          {txtMode === "encode" ? "Encoding..." : "Decoding..."}
                        </span>
                      ) : txtMode === "encode" ? (
                        "Encode"
                      ) : (
                        "Decode"
                      )}
                    </button>

                    {txtMode === "encode" && (
                      <button
                        onClick={() =>
                          handleApiCall(
                            () => analyzeGeneric("text"),
                            "textAnalyze"
                          )
                        }
                        disabled={
                          isLoading.textAnalyze ||
                          !txtFile ||
                          (txtMode === "encode" && !txtSecret)
                        }
                        className="px-4 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                      >
                        {isLoading.textAnalyze ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            {"Analyzing..."}
                          </span>
                        ) : (
                          "Analyze"
                        )}
                      </button>
                    )}
                  </div>

                  <AnalysisBox kind="text" />

                  <ResultPane
                    downloadUrl={txtResultUrl}
                    text={txtDecoded}
                    fileName="stego-text.txt"
                    type={txtMode === "encode" ? "download" : "text"}
                  />
                </div>
              </LockedContent>
            </OperationCard>

            {/* Audio Card */}
            <OperationCard
              title="Audio Steganography"
              description="WAV LSB embedding with end-marker. Upload an audio file to encode or decode a hidden message."
              cta={
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200">
                  {"WAV • LSB"}
                </span>
              }
            >
              <LockedContent onClick={handleUpgradeClick}>
                <div className="space-y-4">
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={handleAudioModeChange("encode")}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${audioMode === "encode"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                        }`}
                    >
                      {"Encode"}
                    </button>
                    <button
                      onClick={handleAudioModeChange("decode")}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${audioMode === "decode"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                        }`}
                    >
                      {"Decode"}
                    </button>
                  </div>

                  <FileDrop accept="audio/*" onFile={handleAudioFileSelect} />

                  {audioMode === "encode" && audioFile && (
                    <textarea
                      placeholder="Enter secret message to embed..."
                      value={audioSecret}
                      onChange={handleAudioSecretChange}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] transition-all duration-300"
                    />
                  )}

                  {audioMode === "encode" && audioFile && <RenderSecureOptions />}

                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        handleApiCall(
                          audioMode === "encode" ? encodeAudio : decodeAudio,
                          audioMode === "encode" ? "audioEncode" : "audioDecode"
                        )
                      }
                      disabled={
                        isLoading.audioEncode ||
                        isLoading.audioDecode ||
                        !audioFile ||
                        (audioMode === "encode" && !audioSecret)
                      }
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                    >
                      {isLoading.audioEncode || isLoading.audioDecode ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          {audioMode === "encode"
                            ? "Encoding..."
                            : "Decoding..."}
                        </span>
                      ) : audioMode === "encode" ? (
                        "Encode"
                      ) : (
                        "Decode"
                      )}
                    </button>
                    {audioMode === "encode" && (
                      <button
                        onClick={() =>
                          handleApiCall(
                            () => analyzeGeneric("audio"),
                            "audioAnalyze"
                          )
                        }
                        disabled={
                          isLoading.audioAnalyze ||
                          !audioFile ||
                          (audioMode === "encode" && !audioSecret)
                        }
                        className="px-4 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                      >
                        {isLoading.audioAnalyze ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            {"Analyzing..."}
                          </span>
                        ) : (
                          "Analyze"
                        )}
                      </button>
                    )}
                  </div>

                  <AnalysisBox kind="audio" />

                  <ResultPane
                    downloadUrl={audioResultUrl}
                    text={audioDecoded}
                    fileName="stego-audio.wav"
                    type={audioMode === "encode" ? "download" : "text"}
                  />
                </div>
              </LockedContent>
            </OperationCard>

            {/* Video Card */}
            <OperationCard
              title="Video Steganography"
              description="Frame-based injection with AES-CTR encryption. Upload a video file to encode or decode a hidden message."
              cta={
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200">
                  {"MP4 • Key option"}
                </span>
              }
            >
              <LockedContent onClick={handleUpgradeClick}>
                <div className="space-y-4">
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={handleVideoModeChange("encode")}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${videoMode === "encode"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                        }`}
                    >
                      {"Encode"}
                    </button>
                    <button
                      onClick={handleVideoModeChange("decode")}
                      className={`px-4 py-2 rounded-lg transition-all duration-300 ${videoMode === "decode"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                        }`}
                    >
                      {"Decode"}
                    </button>
                  </div>

                  <FileDrop accept="video/*" onFile={handleVideoFileSelect} />

                  {videoFile && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            {"Frame Number"}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={videoInfo?.totalFrames || 1000}
                            value={videoFrameNumber}
                            onChange={handleVideoFrameChange}
                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            {"Encryption Key"}
                          </label>
                          <input
                            type="text"
                            value={videoKey}
                            onChange={handleVideoKeyChange}
                            placeholder="Optional encryption key"
                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                          />
                        </div>
                      </div>

                      {videoInfo && (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                          {"Video: "}
                          {videoInfo.width}x{videoInfo.height}
                          {", "}
                          {Math.floor(videoInfo.duration)}
                          {"s, ~"}
                          {videoInfo.totalFrames}
                          {" frames total"}
                        </div>
                      )}

                      {videoMode === "encode" && (
                        <textarea
                          placeholder="Enter secret message to embed..."
                          value={videoSecret}
                          onChange={handleVideoSecretChange}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] transition-all duration-300"
                        />
                      )}

                      {videoMode === "encode" && <RenderSecureOptions />}
                    </>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        handleApiCall(
                          videoMode === "encode" ? encodeVideo : decodeVideo,
                          videoMode === "encode" ? "videoEncode" : "videoDecode"
                        )
                      }
                      disabled={
                        isLoading.videoEncode ||
                        isLoading.videoDecode ||
                        !videoFile ||
                        (videoMode === "encode" && !videoSecret)
                      }
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                    >
                      {isLoading.videoEncode || isLoading.videoDecode ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          {videoMode === "encode"
                            ? "Encoding..."
                            : "Decoding..."}
                        </span>
                      ) : videoMode === "encode" ? (
                        "Encode"
                      ) : (
                        "Decode"
                      )}
                    </button>
                    {videoMode === "encode" && (
                      <button
                        onClick={() =>
                          handleApiCall(
                            () => analyzeGeneric("video"),
                            "videoAnalyze"
                          )
                        }
                        disabled={
                          isLoading.videoAnalyze ||
                          !videoFile ||
                          (videoMode === "encode" && !videoSecret)
                        }
                        className="px-4 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all duration-300"
                      >
                        {isLoading.videoAnalyze ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            {"Analyzing..."}
                          </span>
                        ) : (
                          "Analyze"
                        )}
                      </button>
                    )}
                  </div>

                  <AnalysisBox kind="video" />

                  <ResultPane
                    downloadUrl={videoResultUrl}
                    text={videoDecoded}
                    fileName="stego-video.mp4"
                    type={videoMode === "encode" ? "download" : "text"}
                  />
                </div>
              </LockedContent>
            </OperationCard>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
              {"Why Choose StegaSphere?"}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Professional-grade steganography tools built for security and ease of use.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Multi-format Support",
                description:
                  "Support for images, audio, video, and text files.",
                icon: <Layers className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
              },
              {
                title: "Dual Security",
                description:
                  "Steganography + AES-256 encryption.",
                icon: <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />,
              },
              {
                title: "Hidden & Safe",
                description:
                  "Data is hidden securely and withstands basic analysis.",
                icon: <Eye className="w-6 h-6 text-green-600 dark:text-green-400" />,
              },
              {
                title: "Clean Metadata",
                description:
                  "Removes identifying info for better privacy.",
                icon: <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />,
              },
              {
                title: "Fast Processing",
                description:
                  "Optimized algorithms for quick encoding/decoding.",
                icon: <Zap className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />,
              },
              {
                title: "Universal Access",
                description:
                  "No install needed. Works in your browser.",
                icon: <Monitor className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />,
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-blue-500/30 transition-colors"
              >
                <div className="mb-4 inline-flex items-center justify-center p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} />

      {/* Floating History Button */}
      {active && user && (
        <button
          onClick={() => setShowHistory(true)}
          className="fixed bottom-24 right-6 z-40 bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-110"
          title="View Blockchain History"
        >
          <History className="w-6 h-6" />
        </button>
      )}

      {/* SECURE TOKEN MODAL */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 p-6 relative">
            <button
              onClick={() => setShowTokenModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Secure Access Token</h3>
              <p className="text-sm text-zinc-500 mt-1">This token is required to unlock your file.</p>
            </div>

            <div className="flex flex-col items-center gap-6 mb-6">
              <div className="p-4 bg-white rounded-xl shadow-inner border border-zinc-200">
                <QRCodeSVG value={lastGeneratedToken} size={180} />
              </div>

              <div className="w-full">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">Access Token</label>
                <div className="flex items-center gap-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <code className="flex-1 font-mono text-lg text-center text-zinc-800 dark:text-zinc-200 break-all">
                    {lastGeneratedToken}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(lastGeneratedToken);
                      setToast("Token copied!");
                    }}
                    className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200 mb-6">
              <strong>Warning:</strong> Save this token now. It cannot be recovered if lost.
            </div>

            <button
              onClick={() => setShowTokenModal(false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              I have saved my token
            </button>
          </div>
        </div>
      )}

      {/* DECRYPTION INPUT MODAL */}
      {showDecryptionInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 p-6 relative">
            <button
              onClick={() => {
                setShowDecryptionInput(false);
                setPendingDecodedData("");
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mb-4">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Encrypted Content</h3>
              <p className="text-sm text-zinc-500 mt-1">Enter the access token to unlock this file.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">Access Token</label>
                <input
                  type="text"
                  value={decryptionToken}
                  onChange={(e) => setDecryptionToken(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-purple-500 font-mono text-center text-lg"
                  placeholder="Enter token..."
                />
              </div>

              <button
                onClick={handleUnlockPayload}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                Unlock Content
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Prompt Modal */}
      <AuthPromptModal />

      <SubscriptionModal
        isOpen={showSubscription}
        onClose={() => setShowSubscription(false)}
        onSuccess={handleSubscriptionSuccess}
      />

      <Footer />
      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
