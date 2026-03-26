"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, ArrowRight, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);
  const [email, setEmail] = useState(emailParam || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_M_BASE || 'http://localhost:4000';

  // Derive code from digits for submission
  const code = digits.join("");

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = (index, value) => {
    // Allow only numbers
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    
    // Handle case where user is typing a single digit
    if (value.length <= 1) {
      newDigits[index] = value;
      setDigits(newDigits);
      
      // Auto-advance focus
      if (value && index < 5) {
        inputRefs.current[index + 1].focus();
      }
    } 
    // Handle paste content landing in first input (usually handled by onPaste, but good backup)
    else if (value.length > 1) {
       const pastedChars = value.slice(0, 6).split("");
       for (let i = 0; i < 6; i++) {
         if (pastedChars[i]) newDigits[i] = pastedChars[i];
       }
       setDigits(newDigits);
       // Focus last populated input
       const lastIndex = Math.min(pastedChars.length - 1, 5);
       inputRefs.current[lastIndex]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // If current is empty, move back and delete previous
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputRefs.current[index - 1].focus();
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    
    if (pastedData) {
      const newDigits = [...digits];
      pastedData.split("").forEach((char, i) => {
        newDigits[i] = char;
      });
      setDigits(newDigits);
      
      // Focus the input after the last pasted character
      const nextFocus = Math.min(pastedData.length, 5);
      inputRefs.current[nextFocus]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (code.length !== 6) {
        setError("Please enter a valid 6-digit code");
        setLoading(false);
        return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Verification failed");
      }

      setSuccess("Email verified successfully! Redirecting...");
      
      // Redirect to home/dashboard
      setTimeout(() => {
        router.push("/");
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setLoading(true); // temporary lock
    setError("");

    try {
        const response = await fetch(`${API_BASE_URL}/api/resend-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) throw new Error("Failed to resend");

        setCountdown(60);
        setCanResend(false);
        setSuccess("Verification code sent again!");
        setTimeout(() => setSuccess(""), 3000);

    } catch (err) {
        setError("Failed to resend code. Please try again.");
    } finally {
        setLoading(false); // remove lock only on button state not global
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-8">
        
        <div className="text-center mb-8">
          <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Check your email</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            We sent a verification code to <br/>
            <span className="font-semibold text-zinc-900 dark:text-zinc-200">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-center gap-2 sm:gap-4">
             {digits.map((digit, index) => (
               <input
                 key={index}
                 ref={(el) => (inputRefs.current[index] = el)}
                 type="text"
                 inputMode="numeric"
                 maxLength={6} // Allow paste but we control value length in code
                 value={digit}
                 onChange={(e) => handleChange(index, e.target.value)}
                 onKeyDown={(e) => handleKeyDown(index, e)}
                 onPaste={handlePaste}
                 className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
               />
             ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? "Verifying..." : "Verify Email"}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="mt-6 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Didn't receive the code?
            </p>
            <button
                onClick={handleResend}
                disabled={!canResend || loading}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
            >
                <RefreshCw className={`w-4 h-4 ${!canResend && countdown > 0 ? "animate-spin" : ""}`} />
                {canResend ? "Resend Code" : `Resend in ${countdown}s`}
            </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700 text-center">
            <Link 
                href="/login"
                className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"
            >
                Back to Login
            </Link>
        </div>

      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <VerifyEmailContent />
        </Suspense>
    );
}
