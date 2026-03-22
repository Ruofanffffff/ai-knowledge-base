import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/600cc0a2e59f846c93e6529bc524d2ae023eb689.png';
import { Lock, Mail, Check, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// ---------------------------------------------------------------------------
// OAuth env check
// ---------------------------------------------------------------------------
const OAUTH_ENABLED = import.meta.env.VITE_ENABLE_OAUTH === 'true';

// ---------------------------------------------------------------------------
// WeChat SVG icon (brand)
// ---------------------------------------------------------------------------
function WeChatIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.127 6.127 0 0 1-.253-1.726c0-3.573 3.26-6.47 7.278-6.47.122 0 .243.005.364.014-.494-3.55-4.206-6.45-8.298-6.45zM5.785 5.991a1.09 1.09 0 1 1 0 2.181 1.09 1.09 0 0 1 0-2.181zm5.812 0a1.09 1.09 0 1 1 0 2.181 1.09 1.09 0 0 1 0-2.181zm3.93 3.515c-3.571 0-6.467 2.588-6.467 5.783 0 3.2 2.896 5.783 6.467 5.783a7.604 7.604 0 0 0 2.146-.307.723.723 0 0 1 .593.084l1.5.876a.271.271 0 0 0 .14.047c.133 0 .24-.108.24-.243 0-.06-.024-.118-.038-.174l-.305-1.161a.488.488 0 0 1 .177-.55C21.24 18.82 22.195 17.1 22.195 15.29c0-3.195-2.896-5.784-6.467-5.784zm-2.27 3.243a.907.907 0 1 1 0 1.814.907.907 0 0 1 0-1.814zm4.541 0a.907.907 0 1 1 0 1.814.907.907 0 0 1 0-1.814z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Google SVG icon (brand)
// ---------------------------------------------------------------------------
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------
export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState<{ message: string; remaining: number } | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutInfo || lockoutInfo.remaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutInfo(prev => {
        if (!prev || prev.remaining <= 1) {
          clearInterval(timer);
          return null;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutInfo]);

  const handleLogin = async () => {
    if (!email.trim() && !password.trim()) {
      setError('请输入用户名/邮箱和密码');
      return;
    }

    if (!email.trim()) {
      setError('请输入用户名或邮箱');
      return;
    }

    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setIsLoading(true);
    setError('');
    setLockoutInfo(null);

    try {
      // Allow username login by passing email field as username/email/phone
      await login({ username: email, password });
      // Show success animation, then navigate after 500ms
      setLoginSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } catch (err: any) {
      // Handle account lockout
      if (err.status === 423 || err.lockout_remaining) {
        const remaining = err.lockout_remaining || 300;
        setLockoutInfo({
          message: err.message || '账号已锁定，请稍后再试',
          remaining,
        });
      } else {
        setError(err.message || '登录失败，请检查邮箱和密码');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = (provider: string) => {
    // OAuth login is handled externally; placeholder for future integration
    console.log(`OAuth login with ${provider}`);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-100 rounded-full blur-3xl opacity-30 mix-blend-multiply animate-blob" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] bg-pink-100 rounded-full blur-3xl opacity-30 mix-blend-multiply animate-blob animation-delay-2000" />
      <div className="absolute top-[20%] left-[20%] w-[600px] h-[600px] bg-purple-100 rounded-full blur-3xl opacity-30 mix-blend-multiply animate-blob animation-delay-4000" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 md:p-12"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-24 h-24 mb-6 relative"
          >
             <div className="absolute inset-0 bg-gradient-to-tr from-pink-500 via-purple-500 to-blue-500 rounded-full blur-2xl opacity-20" />
             <img src={logo} alt="BrainBase Logo" className="w-full h-full object-contain relative z-10" />
          </motion.div>
          
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 mb-2">
            拾思
          </h1>
          <p className="text-slate-500">
            拾思相伴，登录收纳每一刻灵感与知识
          </p>
        </div>

        <div className="space-y-4">
          {/* Email/Username input */}
          <div className="group">
            <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">用户名 / 邮箱</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-500 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="用户名或邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                disabled={isLoading || loginSuccess}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-12 py-3.5 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="group">
            <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">密码</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-500 transition-colors" size={20} />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                disabled={isLoading || loginSuccess}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-12 py-3.5 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Error message with AnimatePresence */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Account lockout warning */}
          <AnimatePresence>
            {lockoutInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p>{lockoutInfo.message}</p>
                    {lockoutInfo.remaining > 0 && (
                      <p className="mt-1 font-medium">
                        剩余锁定时间：{Math.floor(lockoutInfo.remaining / 60)}分{lockoutInfo.remaining % 60}秒
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Remember me + Forgot password */}
          <div className="flex items-center justify-between text-sm py-2">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600">
              <input type="checkbox" className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
              记住我
            </label>
            <button className="text-purple-600 hover:text-purple-700 font-medium">忘记密码？</button>
          </div>

          {/* Login button with success animation */}
          <button 
            onClick={handleLogin}
            disabled={isLoading || loginSuccess}
            className={`w-full font-semibold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:cursor-not-allowed ${
              loginSuccess
                ? 'bg-green-500 text-white shadow-green-500/25'
                : 'bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white shadow-purple-500/25 hover:shadow-purple-500/40 disabled:opacity-50'
            }`}
          >
            {loginSuccess ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-2"
              >
                <Check size={20} />
                登录成功
              </motion.span>
            ) : isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                登录中...
              </span>
            ) : (
              <span>登录</span>
            )}
          </button>

          {/* OAuth section - conditional on VITE_ENABLE_OAUTH */}
          {OAUTH_ENABLED && (
            <>
              {/* Divider */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-sm text-slate-400">或</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* OAuth buttons */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleOAuthLogin('wechat')}
                  disabled={isLoading || loginSuccess}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-white text-[#07C160] font-medium hover:bg-[#07C160]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <WeChatIcon size={20} />
                  <span>微信登录</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleOAuthLogin('google')}
                  disabled={isLoading || loginSuccess}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GoogleIcon size={20} />
                  <span>Google</span>
                </motion.button>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 text-center text-sm text-slate-500">
          还没有账号？ <button onClick={() => navigate('/register')} className="text-purple-600 font-semibold hover:underline">注册账号</button>
        </div>
      </motion.div>
    </div>
  );
}
