"use client"
import { useState } from 'react';
import { useSession, signIn } from "next-auth/react";
import { useRouter } from 'next/navigation';

const Page = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoginForm, setIsLoginForm] = useState(true);
  const [showTwoFactor, setShowTwoFactor] = useState(false); // New State for 2FA
  const [tempTwoFactorToken, setTempTwoFactorToken] = useState(null); // New State for Temp Token
  const [twoFactorCode, setTwoFactorCode] = useState(''); // New State for 2FA Code

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // API base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_M_BASE || 'http://localhost:4000';

  // Redirect to home page if user is already logged in
  if (session) {
    router.push('/connect-wallet');
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleTwoFactorCodeChange = (e) => {
    setTwoFactorCode(e.target.value);
    if (errors.otp) setErrors(prev => ({ ...prev, otp: '' }));
  };

  const validateLoginForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignupForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTwoFactorVerify = async (e) => {
    e.preventDefault();
    if(!twoFactorCode) {
      setErrors({ otp: 'Code is required' });
      return;
    }
    setIsLoading(true);
    try {
       const response = await fetch(`${API_BASE_URL}/api/auth/2fa/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: tempTwoFactorToken, code: twoFactorCode }),
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Verification failed');

      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/connect-wallet');
    } catch (error) {
      setErrors({ otp: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        }),
        credentials: 'include' 
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.isNotVerified) {
             router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
             return; 
        }
        throw new Error(data.message || 'Login failed');
      }

      // Check for 2FA requirement
      if (data.require2FA) {
        setTempTwoFactorToken(data.tempToken);
        setShowTwoFactor(true);
        setIsLoading(false); // Stop loading to show new form
        return;
      }

      // Store ONLY user data (no token) - token is in HttpOnly cookie
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Redirect to connect wallet page
      router.push('/connect-wallet');
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  const handleSignup = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password
        }),
        credentials: 'include' 
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Success - redirect to verification page
      router.push(`/verify-email?email=${encodeURIComponent(formData.email.trim().toLowerCase())}`);
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const isValid = isLoginForm ? validateLoginForm() : validateSignupForm();
    if (!isValid) return;

    setIsLoading(true);
    setErrors({});

    try {
      if (isLoginForm) {
        await handleLogin();
      } else {
        await handleSignup();
      }
      
    } catch (error) {
      console.error(isLoginForm ? 'Login error:' : 'Signup error:', error);
      setErrors({ 
        submit: error.message || (isLoginForm ? 'Login failed' : 'Signup failed') 
      });
      setIsLoading(false); // Ensure loading is off on error
    } 
    // note: finally block moved into individual handlers or managed there because handleLogin might return early for 2FA without turning off loading if we weren't careful. 
    // Actually I handled setIsLoading(false) inside handleLogin for 2FA case.
    // But for success case, we redirect so it doesn't matter.
    // For error case, we turn it off here.
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signIn("google", { callbackUrl: '/connect-wallet' });
    } catch (error) {
      console.error('Google sign in error:', error);
      setErrors({ submit: 'Google sign in failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleForm = () => {
    setIsLoginForm(!isLoginForm);
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
    setErrors({});
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // 2FA Render Block
  if (showTwoFactor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">Two-Factor Authentication</h2>
            <p className="mt-2 text-sm text-gray-600">
              Please enter the 6-digit code from your authenticator app.
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleTwoFactorVerify}>
             <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                Authentication Code
              </label>
              <input
                id="otp"
                type="text"
                maxLength="6"
                className={`text-center tracking-[1em] text-2xl font-mono relative block w-full px-3 py-3 border ${
                  errors.otp ? 'border-red-500' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                value={twoFactorCode}
                onChange={handleTwoFactorCodeChange}
                placeholder="000000"
                disabled={isLoading}
                autoFocus
              />
              {errors.otp && (
                <p className="mt-1 text-sm text-red-600 text-center">{errors.otp}</p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>
            
            <div className="text-center mt-4">
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-500"
                onClick={() => { setShowTwoFactor(false); setTempTwoFactorToken(null); }}
              >
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {isLoginForm ? 'Sign in to your account' : 'Create your account'}
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            {isLoginForm ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={toggleForm}
              className="font-medium text-blue-600 hover:text-blue-500 transition-colors focus:outline-none"
            >
              {isLoginForm ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                className={`relative block w-full px-3 py-3 border ${
                  errors.username ? 'border-red-500' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors`}
                placeholder={isLoginForm ? 'Enter your username' : 'Choose a username'}
                value={formData.username}
                onChange={handleChange}
                disabled={isLoading}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
              )}
            </div>
            {!isLoginForm && (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={`relative block w-full px-3 py-3 border ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors`}
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>
            )}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isLoginForm ? "current-password" : "new-password"}
                className={`relative block w-full px-3 py-3 border ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors`}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {!isLoginForm && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={`relative block w-full px-3 py-3 border ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors`}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>
            )}
          </div>

          {isLoginForm && (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <a href="#" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                  Forgot your password?
                </a>
              </div>
            </div>
          )}
          {!isLoginForm && (
            <div className="flex items-center">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                required
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                I agree to the{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500 transition-colors">
                  Terms and Conditions
                </a>
              </label>
            </div>
          )}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isLoginForm ? 'Signing in...' : 'Creating account...'}
                </div>
              ) : (
                isLoginForm ? 'Sign in' : 'Create account'
              )}
            </button>
          </div>

          {errors.submit && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Or continue with</span>
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {isLoginForm ? 'Sign in with Google' : 'Sign up with Google'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Page;