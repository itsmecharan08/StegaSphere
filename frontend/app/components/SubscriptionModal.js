"use client";
import { useState } from 'react';

const SubscriptionModal = ({ isOpen, onClose, onSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState('monthly');

  const plans = {
    monthly: { 
      id: '1month',  // This needs to match your backend's expected values
      type: '1month',
      price: 299, 
      amount: 299,
      period: 'month', 
      description: 'Perfect for individual users',
      currency: 'INR'
    },
    yearly: { 
      id: '1year',   // This needs to match your backend's expected values
      type: '1year',
      price: 1599, 
      amount: 1599,
      period: 'year', 
      description: 'Best value - save 55%',
      currency: 'INR'
    }
  };

  const loadScript = (src) => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    
    if (!res) {
      alert("Payment system is temporarily unavailable. Please try again later.");
      return;
    }

    const plan = plans[selectedPlan];
    const amount = plan.price * 100; // Convert to paise

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_RGAWCIP7v5zbCv",
      amount: amount,
      currency: "INR",
      name: "StegaSphere Pro",
      description: `StegaSphere ${plan.period}ly subscription`,
      image: "/logo.png",
      handler: function (response) {
        console.log('Razorpay response:', response);
        onSuccess(response, plan);
      },
      prefill: {
        name: "",
        email: "",
        contact: ""
      },
      notes: {
        plan: selectedPlan,
        period: plan.period
      },
      theme: {
        color: "#158993"
      }
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.open();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Upgrade to Pro</h2>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div 
            className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
              selectedPlan === 'monthly' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-zinc-200 dark:border-zinc-600'
            }`}
            onClick={() => setSelectedPlan('monthly')}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">Monthly Plan</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">₹299 per month</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-zinc-900 dark:text-white">₹299</div>
                <div className="text-sm text-zinc-500">per month</div>
              </div>
            </div>
          </div>

          <div 
            className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
              selectedPlan === 'yearly' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-zinc-200 dark:border-zinc-600'
            }`}
            onClick={() => setSelectedPlan('yearly')}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">Yearly Plan</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Save 55% - ₹1599 per year</p>
                <span className="inline-block mt-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-full">
                  Most Popular
                </span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-zinc-900 dark:text-white">₹1599</div>
                <div className="text-sm text-zinc-500">per year</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button 
            onClick={handlePayment}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Subscribe Now - ₹{plans[selectedPlan].price}
          </button>
          <button 
            onClick={onClose}
            className="w-full border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 py-3 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            Maybe Later
          </button>
        </div>

        <p className="text-xs text-zinc-500 text-center mt-4">
          Secure payment powered by Razorpay
        </p>
      </div>
    </div>
  );
};

export default SubscriptionModal;