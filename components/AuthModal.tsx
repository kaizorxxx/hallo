import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // New Fields
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Rate Limiting State
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // Countdown timer effect
  useEffect(() => {
    let interval: any;
    if (rateLimitSeconds > 0) {
        interval = setInterval(() => {
            setRateLimitSeconds((prev) => prev - 1);
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [rateLimitSeconds]);

  // Reset fields when mode changes or modal opens
  useEffect(() => {
    if(isOpen) {
        setErrorMsg('');
        // Optional: clear inputs on open
    }
  }, [isOpen, isSignUp]);

  if (!isOpen) return null;

  const handleAuth = async () => {
    setErrorMsg('');

    if (isSignUp) {
        // Validation
        if (password !== confirmPassword) {
            setErrorMsg("Passwords do not match.");
            return;
        }
        if (!fullName.trim() || !phoneNumber.trim()) {
            setErrorMsg("Please fill in all fields.");
            return;
        }
        // Prevent spam
        if (rateLimitSeconds > 0) return;
        
        setLoading(true);
        try {
            // Include metadata directly in signUp options
            // This is safer and ensures data is stored even if profiles insert fails
            const { data, error } = await supabase.auth.signUp({ 
                email, 
                password,
                options: {
                    emailRedirectTo: window.location.origin,
                    data: {
                        full_name: fullName,
                        phone: phoneNumber,
                        username: email.split('@')[0],
                    }
                }
            });
            
            if (error) throw error;

            // Attempt to insert into profiles table as well
            if (data.user) {
                const { error: profileError } = await supabase.from('profiles').upsert({
                    id: data.user.id,
                    username: email.split('@')[0], // Default username
                    full_name: fullName,
                    phone: phoneNumber,
                    updated_at: new Date()
                });
                
                if (profileError) {
                    // We log this but don't stop the flow because metadata is already saved in Auth
                    console.error("Warning: Profile table insert failed (Metadata saved in Auth).", profileError);
                }
            }

            // Trigger rate limit
            setRateLimitSeconds(30);

            // Inform user
            if (data.user && !data.session) {
                alert('Registration successful! Please check your email inbox to verify your account before logging in.');
                onClose();
            } else if (data.user && data.session) {
                onClose();
            }
        } catch (error: any) {
            setErrorMsg(error.message);
        } finally {
            setLoading(false);
        }
    } else {
        // Login Flow
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            onClose();
        } catch (error: any) {
            setErrorMsg(error.message);
        } finally {
            setLoading(false);
        }
    }
  };

  const handleOAuth = async (provider: 'google' | 'github' | 'facebook') => {
    try {
        const { error } = await supabase.auth.signInWithOAuth({ 
            provider,
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
    } catch (error: any) {
        setErrorMsg(error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[300] flex justify-center items-center p-5 backdrop-blur-sm">
      <div className="bg-[#282828] w-full max-w-[350px] p-6 rounded-xl shadow-2xl flex flex-col gap-3 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <h3 className="text-xl font-bold text-center text-white mb-2">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h3>

        {errorMsg && <p className="text-red-500 text-xs text-center font-bold bg-red-900/20 p-2 rounded">{errorMsg}</p>}

        {isSignUp && (
            <>
                <input
                    type="text"
                    placeholder="Full Name"
                    className="bg-[#3e3e3e] border border-[#555] p-3 rounded-md text-white outline-none text-sm w-full focus:border-[#1db954] transition-colors"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                />
                <input
                    type="tel"
                    placeholder="Active Phone Number"
                    className="bg-[#3e3e3e] border border-[#555] p-3 rounded-md text-white outline-none text-sm w-full focus:border-[#1db954] transition-colors"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                />
            </>
        )}

        <input
          type="email"
          placeholder="Email"
          className="bg-[#3e3e3e] border border-[#555] p-3 rounded-md text-white outline-none text-sm w-full focus:border-[#1db954] transition-colors"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="bg-[#3e3e3e] border border-[#555] p-3 rounded-md text-white outline-none text-sm w-full focus:border-[#1db954] transition-colors"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {isSignUp && (
            <input
                type="password"
                placeholder="Confirm Password"
                className="bg-[#3e3e3e] border border-[#555] p-3 rounded-md text-white outline-none text-sm w-full focus:border-[#1db954] transition-colors"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
            />
        )}

        <button
          onClick={handleAuth}
          disabled={loading || (isSignUp && rateLimitSeconds > 0)}
          className="bg-[#1db954] text-black font-bold py-3 rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed mt-2"
        >
          {loading 
            ? 'Processing...' 
            : isSignUp 
                ? (rateLimitSeconds > 0 ? `Wait ${rateLimitSeconds}s` : 'Sign Up') 
                : 'Log In'
          }
        </button>

        <div className="flex items-center gap-2 my-1">
          <div className="h-[1px] bg-[#555] flex-1"></div>
          <span className="text-xs text-[#aaa]">OR</span>
          <div className="h-[1px] bg-[#555] flex-1"></div>
        </div>

        <div className="flex gap-3 justify-center">
            <button onClick={() => handleOAuth('google')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                <i className="fa-brands fa-google text-black text-lg"></i>
            </button>
            <button onClick={() => handleOAuth('github')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                <i className="fa-brands fa-github text-black text-lg"></i>
            </button>
            <button onClick={() => handleOAuth('facebook')} className="w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                <i className="fa-brands fa-facebook-f text-white text-lg"></i>
            </button>
        </div>

        <div className="text-center mt-2">
            <p className="text-xs text-[#bbb] cursor-pointer hover:text-white underline" onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
            </p>
        </div>
        
        <button onClick={onClose} className="text-xs text-[#777] hover:text-white mt-1">Cancel</button>
      </div>
    </div>
  );
};

export default AuthModal;