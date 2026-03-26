"use client";
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from "next-auth/react";

export default function Navbar({ user: propUser, isSubscribed: propIsSubscribed, onLogout }) {
  const [isMounted, setIsMounted] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const API_M_BASE = process.env.NEXT_PUBLIC_API_M_BASE || 'http://localhost:4000';

  // Use propUser if provided, otherwise fetch locally
  const currentUser = propUser || userData;

  // Use propIsSubscribed if available
  const displayIsSubscribed = propIsSubscribed !== undefined ? propIsSubscribed : currentUser?.isSubscribed;

  useEffect(() => {
    setIsMounted(true);

    // Only fetch if propUser is not provided
    if (!propUser) {
      fetchUserData();
    } else {
      setIsLoading(false);
    }
  }, [propUser]);

  // Fetch user data from database using cookies
  const fetchUserData = async () => {
    try {
      if (session) {
        // Google user - use session data
        setUserData({
          name: session.user?.name || session.user?.email,
          email: session.user?.email,
          image: session.user?.image,
          isGoogle: true,
          isSubscribed: false
        });
        setIsLoading(false);
      } else {
        // Manual login user - fetch from database (cookies automatically sent)
        const response = await fetch(`${API_M_BASE}/api/user/me`, {
          credentials: 'include' // IMPORTANT: Send cookies
        });

        if (response.ok) {
          const data = await response.json();
          setUserData({
            name: data.user.username,
            email: data.user.email,
            image: null,
            isGoogle: false,
            isSubscribed: data.user.hasActiveSubscription,
            subscriptionPlan: data.user.subscriptionPlan,
            ...data.user
          });
        } else if (response.status === 401) {
          // User is not logged in - THIS IS NORMAL
          console.log('User not authenticated (401) - normal for first visit');
          setUserData(null);
        } else {
          // Other error
          console.error('Error fetching user:', response.status);
          setUserData(null);
        }
      }
    } catch (error) {
      console.error('Network error fetching user data:', error.message);
      setUserData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetStarted = () => {
    if (session || userData) {
      router.push('/');
    } else {
      router.push('/login');
    }
  };

  const handleLogoClick = () => {
    router.push('/');
  };

  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const handleLogout = async () => {
    if (onLogout) {
      // Use parent's logout handler if provided
      await onLogout();
    } else {
      // Fallback to local logout (old logic)
      if (session) {
        await signOut();
      } else {
        try {
          await fetch(`${API_M_BASE}/api/logout`, {
            method: 'POST',
            credentials: 'include'
          });
        } catch (error) {
          console.error('Logout error:', error);
        }
      }

      // Clear localStorage
      localStorage.removeItem('user');

      // Clear local state
      setUserData(null);
      setShowProfileMenu(false);

      // Refresh page
      router.push('/');
      router.refresh();
    }
  };

  const handleProfileNavigation = (path) => {
    setShowProfileMenu(false);
    router.push(path);
  };

  if (!isMounted || isLoading) {
    return (
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
          <span className="font-semibold text-xl">StegaSphere</span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={handleLogoClick}
          >
            <img
              src="/chatting.png"
              alt="StegaSphere"
              className="w-8 h-8 transition-transform hover:scale-110"
            />
            <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              StegaSphere
            </span>
            {displayIsSubscribed && (  // <-- USE displayIsSubscribed HERE
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                PRO
              </span>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6">
            <a
              href="#features"
              className="text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
            >
              Features
            </a>
            <a
              href="#how"
              className="text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
            >
              How it works
            </a>
            <a
              href="#tools"
              className="text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
            >
              Tools
            </a>
            <a
              href="/detect"
              className="text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              Detect
            </a>

            <a
              href="/multilayer"
              className="text-zinc-700 dark:text-zinc-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors font-medium flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
              Multilayer
            </a>

            {/* User Profile */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={handleProfileClick}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {currentUser.image ? (
                    <img
                      src={currentUser.image}
                      alt="Profile"
                      className="w-8 h-8 rounded-full border-2 border-blue-500"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {currentUser.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium max-w-[120px] truncate">
                    {currentUser.name || currentUser.email}
                  </span>
                  <svg
                    className={`w-4 h-4 text-zinc-500 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile dropdown menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-2 z-50">
                    <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {currentUser.name || 'User'}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {currentUser.email}
                      </p>
                      {displayIsSubscribed && (  // <-- USE displayIsSubscribed HERE TOO
                        <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          PRO Active
                        </span>
                      )}
                    </div>
                    {pathname !== '/dashboard' && (
                      <button
                        onClick={() => handleProfileNavigation('/dashboard')}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        Dashboard
                      </button>
                    )}
                    {pathname !== '/profile' && (
                      <button
                        onClick={() => handleProfileNavigation('/profile')}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        Profile
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleGetStarted}
                className="px-4 py-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity shadow-md"
              >
                Get Started
              </button>
            )}
          </nav>

          {/* Mobile menu */}
          <div className="lg:hidden flex items-center gap-2">
            {currentUser ? (
              <>
                {/* Mobile profile button */}
                <button
                  onClick={handleProfileClick}
                  className="p-2 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {currentUser.image ? (
                    <img
                      src={currentUser.image}
                      alt="Profile"
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                      {currentUser.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                </button>

                {/* Mobile profile menu */}
                {showProfileMenu && (
                  <div className="absolute top-16 right-4 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-2 z-50">
                    <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {currentUser.name || 'User'}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {currentUser.email}
                      </p>
                      {displayIsSubscribed && (  // <-- USE displayIsSubscribed HERE TOO
                        <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          PRO Active
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleProfileNavigation('/dashboard')}
                      className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      🏠 Dashboard
                    </button>

                    <button
                      onClick={() => handleProfileNavigation('/profile')}
                      className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      👤 Profile
                    </button>

                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      🚪 Sign Out
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={handleGetStarted}
                className="px-3 py-1 text-sm rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity"
              >
                Get Started
              </button>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {showMobileMenu ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {showMobileMenu && (
        <div className="lg:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 pt-2 pb-4 shadow-lg space-y-1">
          <a
            href="#features"
            onClick={() => setShowMobileMenu(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Features
          </a>
          <a
            href="#how"
            onClick={() => setShowMobileMenu(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            How it works
          </a>
          <a
            href="#tools"
            onClick={() => setShowMobileMenu(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Tools
          </a>
          <a
            href="/detect"
            onClick={() => setShowMobileMenu(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            Detect
          </a>

          <a
            href="/multilayer"
            onClick={() => setShowMobileMenu(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-zinc-700 dark:text-zinc-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            Multilayer
          </a>
        </div>
      )}

      {showProfileMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowProfileMenu(false)}
        />
      )}
    </header>
  );
}