"use client";
import { useState, useEffect } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { User, Mail, Calendar, Shield, Crown, Clock, CheckCircle, AlertTriangle } from "lucide-react";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 2FA State
  const [qrCode, setQrCode] = useState(null);
  const [otp, setOtp] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const API_BASE = process.env.NEXT_PUBLIC_API_M_BASE || 'http://localhost:4000';

  // Fetch user data
  useEffect(() => {
    if (status === 'loading') return;

    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/user/me`, {
          credentials: 'include'
        });
        
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
             if (session?.user) {
                 setUser({
                     username: session.user.name,
                     email: session.user.email,
                     isGoogle: true,
                     ...session.user
                 });
             } else {
               router.push('/login');
             }
        }
      } catch (err) {
        if (session?.user) {
             setUser({
                 username: session.user.name,
                 email: session.user.email,
                 isGoogle: true,
                 ...session.user
             });
         } else {
           router.push('/login');
         }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [status, session, router]);

  const setup2FA = async () => {
    try {
        const res = await fetch(`${API_BASE}/api/auth/2fa/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            setQrCode(data.qrCode);
            setShowSetup(true);
            setMessage({ type: '', text: '' });
        } else {
            setMessage({ type: 'error', text: data.message });
        }
    } catch (err) {
        setMessage({ type: 'error', text: 'Failed to setup 2FA' });
    }
  };

  const verifyAndEnable2FA = async () => {
      try {
          const res = await fetch(`${API_BASE}/api/auth/2fa/enable`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: otp }),
              credentials: 'include'
          });
          const data = await res.json();
          if (res.ok) {
              setUser(prev => ({ ...prev, isTwoFactorEnabled: true }));
              setShowSetup(false);
              setQrCode(null);
              setOtp('');
              setMessage({ type: 'success', text: 'Two-Factor Authentication Enabled!' });
          } else {
              setMessage({ type: 'error', text: data.message });
          }
      } catch (err) {
          setMessage({ type: 'error', text: 'Verification failed' });
      }
  };

  const disable2FA = async () => {
      if (!confirm("Are you sure you want to disable 2FA? This will make your account less secure.")) return;
       try {
          const res = await fetch(`${API_BASE}/api/auth/2fa/disable`, {
              method: 'POST',
              credentials: 'include'
          });
          if (res.ok) {
              setUser(prev => ({ ...prev, isTwoFactorEnabled: false }));
              setMessage({ type: 'success', text: 'Two-Factor Authentication Disabled' });
          }
      } catch (err) {
          setMessage({ type: 'error', text: 'Failed to disable 2FA' });
      }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Navbar user={user} />
      
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-8">My Profile</h1>
        
        {message.text && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {message.type === 'error' ? <AlertTriangle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}
                {message.text}
            </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
            {/* User Info Card */}
            <div className="md:col-span-2 space-y-6">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-start gap-6">
                        <div className="flex-shrink-0">
                            {user.image ? (
                                <img src={user.image} alt="Profile" className="w-24 h-24 rounded-full border-4 border-blue-100 dark:border-blue-900" />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                                    {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                                {user.username || user.name || 'User'}
                            </h2>
                             <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 mb-4">
                                <Mail className="w-4 h-4" />
                                <span>{user.email}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {user.hasActiveSubscription ? (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium">
                                        <Crown className="w-3 h-3" /> PRO Member
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-medium">
                                        Free Plan
                                    </span>
                                )}
                                {user.isTwoFactorEnabled && (
                                     <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-sm font-medium">
                                        <Shield className="w-3 h-3" /> 2FA Active
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Account Details</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                            <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                                <User className="w-5 h-5" />
                                <span>Username</span>
                            </div>
                            <span className="font-medium text-zinc-900 dark:text-white">{user.username || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                            <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                                <Mail className="w-5 h-5" />
                                <span>Email</span>
                            </div>
                            <span className="font-medium text-zinc-900 dark:text-white">{user.email}</span>
                        </div>
                         <div className="flex justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                            <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                                <Calendar className="w-5 h-5" />
                                <span>Member Since</span>
                            </div>
                            <span className="font-medium text-zinc-900 dark:text-white">{formatDate(user.createdAt || user.created_at || new Date().toISOString())}</span>
                        </div>
                    </div>
                </div>

                {/* 2FA Security Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5" /> Security & Authentication
                    </h3>
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 border-b border-zinc-100 dark:border-zinc-800 last:border-0 gap-4">
                        <div>
                            <h4 className="font-medium text-zinc-900 dark:text-white">Two-Factor Authentication (2FA)</h4>
                            <p className="text-sm text-zinc-500 mt-1">Protect your account with an extra layer of security using an authenticator app.</p>
                        </div>
                        {user.isTwoFactorEnabled ? (
                            <button onClick={disable2FA} className="flex-shrink-0 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">
                                Disable 2FA
                            </button>
                        ) : (
                            <button onClick={setup2FA} className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                                Enable 2FA
                            </button>
                        )}
                    </div>

                    {showSetup && !user.isTwoFactorEnabled && (
                        <div className="mt-6 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 animate-in fade-in slide-in-from-top-4">
                            <h4 className="font-semibold text-zinc-900 dark:text-white mb-4">Set up Authenticator App</h4>
                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                 <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200">
                                    {qrCode ? (
                                        <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 mix-blend-multiply" />
                                    ) : (
                                        <div className="w-48 h-48 bg-gray-100 flex items-center justify-center rounded-lg">Loading...</div>
                                    )}
                                 </div>
                                 <div className="flex-1 space-y-6">
                                     <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">1</span>
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white">Scan QR Code</p>
                                        </div>
                                        <p className="text-sm text-zinc-500 ml-8">Open your authenticator app (like Google Authenticator or Authy) and scan this QR code.</p>
                                     </div>
                                     <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">2</span>
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white">Enter Verification Code</p>
                                        </div>
                                        <p className="text-sm text-zinc-500 ml-8 mb-3">Enter the 6-digit code from your app to verify setup.</p>
                                        <div className="ml-8 flex flex-col sm:flex-row gap-3">
                                            <input 
                                                type="text" 
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-800 w-full sm:w-40 tracking-[0.25em] text-center font-mono text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="000000"
                                            />
                                            <button 
                                                onClick={verifyAndEnable2FA} 
                                                disabled={otp.length !== 6}
                                                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Verify
                                            </button>
                                        </div>
                                     </div>
                                 </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar / Stats */}
             <div className="space-y-6">
                 <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                    <h3 className="text-lg font-semibold mb-2">Subscription Status</h3>
                    <div className="mb-4">
                        {user.hasActiveSubscription ? (
                            <div className="text-3xl font-bold mb-1">PRO</div>
                        ) : (
                            <div className="text-3xl font-bold mb-1">Free</div>
                        )}
                        <p className="text-blue-100 text-sm"> Current Plan</p>
                    </div>
                    {user.hasActiveSubscription ? (
                        <p className="text-sm text-blue-100">Your pro benefits are active. Enjoy unlimited access!</p>
                    ) : (
                        <button className="w-full py-2 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors">
                            Upgrade to Pro
                        </button>
                    )}
                 </div>

                 <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Account Status</h3>
                    <div className="flex items-center gap-3 mb-4 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Email Verified</span>
                    </div>
                     <div className="flex items-center gap-3 text-zinc-500 text-sm">
                        <Clock className="w-5 h-5" />
                        <span>Last Login: Just now</span>
                    </div>
                 </div>
            </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
