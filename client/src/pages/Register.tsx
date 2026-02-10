import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/600cc0a2e59f846c93e6529bc524d2ae023eb689.png';
import { Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('请填写所有必填字段');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少为6位');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register({ username, email, password });
      navigate('/login');
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
          
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            创建账号
          </h1>
          <p className="text-slate-500">
            注册以开始使用您的智能思库
          </p>
        </div>

        <div className="space-y-4">
          <div className="group">
            <label className="block text-sm font-medium text-slate-700 mb-1 ml-1">用户名 *</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-500 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                disabled={isLoading}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-12 py-3.5 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

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
                disabled={isLoading}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-12 py-3.5 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

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
                disabled={isLoading}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-12 py-3.5 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

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
                disabled={isLoading}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-12 py-3.5 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button 
            onClick={handleRegister}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white font-semibold py-4 rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isLoading ? '注册中...' : '注册'}</span>
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-slate-500">
          已有账号？ <button onClick={() => navigate('/login')} className="text-purple-600 font-semibold hover:underline">登录</button>
        </div>
      </motion.div>
    </div>
  );
}
