import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/600cc0a2e59f846c93e6529bc524d2ae023eb689.png';
import { Lock, Mail, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// ---------------------------------------------------------------------------
// Password strength helpers
// ---------------------------------------------------------------------------

type StrengthLevel = 'weak' | 'medium' | 'strong';

function getPasswordStrength(password: string): { level: StrengthLevel; score: number } {
  if (!password) return { level: 'weak', score: 0 };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { level: 'weak', score: 1 };
  if (score <= 4) return { level: 'medium', score: 2 };
  return { level: 'strong', score: 3 };
}

const strengthConfig: Record<StrengthLevel, { label: string; color: string; width: string }> = {
  weak: { label: '弱', color: 'bg-red-500', width: 'w-1/3' },
  medium: { label: '中', color: 'bg-yellow-500', width: 'w-2/3' },
  strong: { label: '强', color: 'bg-green-500', width: 'w-full' },
};

// ---------------------------------------------------------------------------
// Register Page
// ---------------------------------------------------------------------------

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Derived state
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      setError('请填写所有必填字段');
      return;
    }

    if (password.length < 8) {
      setError('密码长度至少为8位');
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('密码必须包含大写字母、小写字母和数字');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register({ username: '', email, password });
      setRegisterSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 1000);
    } catch (err: any) {
      setError(err.message || '注册失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
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
        {/* Header */}
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
            创建账号
          </h1>
          <p className="text-slate-500">
            注册以开始使用您的智能思库
          </p>
        </div>

        <div className="space-y-4">
          {/* Email input */}
          <div className="group">
            <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">邮箱 *</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-500 transition-colors" size={20} />
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                disabled={isLoading || registerSuccess}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-12 py-3.5 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="group">
            <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">密码 *</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-500 transition-colors" size={20} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                disabled={isLoading || registerSuccess}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-12 py-3.5 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
              />
            </div>

            {/* Password strength indicator */}
            <AnimatePresence>
              {password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${strengthConfig[strength.level].color}`}
                        initial={{ width: 0 }}
                        animate={{ width: strength.score === 1 ? '33%' : strength.score === 2 ? '66%' : '100%' }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${
                      strength.level === 'weak' ? 'text-red-500' :
                      strength.level === 'medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {strengthConfig[strength.level].label}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Confirm password input */}
          <div className="group">
            <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">确认密码 *</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-500 transition-colors" size={20} />
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                disabled={isLoading || registerSuccess}
                className={`w-full bg-slate-50 border rounded-xl px-12 py-3.5 outline-none focus:ring-2 transition-all disabled:opacity-50 ${
                  passwordMismatch
                    ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                    : 'border-slate-200 focus:ring-purple-500/20 focus:border-purple-500'
                }`}
              />
            </div>
            <AnimatePresence>
              {passwordMismatch && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs text-red-500 mt-1 ml-1"
                >
                  两次输入的密码不一致
                </motion.p>
              )}
            </AnimatePresence>
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

          {/* Register button with success animation */}
          <button
            onClick={handleRegister}
            disabled={isLoading || registerSuccess}
            className={`w-full font-semibold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:cursor-not-allowed ${
              registerSuccess
                ? 'bg-green-500 text-white shadow-green-500/25'
                : 'bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white shadow-purple-500/25 hover:shadow-purple-500/40 disabled:opacity-50'
            }`}
          >
            {registerSuccess ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="flex items-center gap-2"
              >
                <Check size={20} />
                注册成功
              </motion.span>
            ) : isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                注册中...
              </span>
            ) : (
              <span>注册</span>
            )}
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-slate-500">
          已有账号？ <button onClick={() => navigate('/login')} className="text-purple-600 font-semibold hover:underline">登录</button>
        </div>
      </motion.div>
    </div>
  );
}
