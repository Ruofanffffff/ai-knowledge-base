import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Server, Wifi, WifiOff, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

export function ServerConfig() {
  const navigate = useNavigate();
  const [serverUrl, setServerUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const savedUrl = localStorage.getItem('serverUrl');
    if (savedUrl) {
      setServerUrl(savedUrl);
    }
  }, []);

  const handleTestConnection = async () => {
    if (!serverUrl) {
      setStatus('error');
      setMessage('Please enter a server URL');
      return;
    }

    setStatus('testing');
    setMessage('Testing connection...');

    try {
      // Try to reach a likely endpoint. Since /api is common, we append it if missing, 
      // but the interceptor logic expects the full base URL or falls back to /api.
      // If user enters "http://192.168.1.5:3000/api", we test that.
      // If user enters "http://192.168.1.5:3000", we might need to append /api depending on how they want to configure it.
      // Based on client.ts: config.baseURL = serverUrl || ...
      // So serverUrl should be the full base URL for API, e.g. "http://192.168.1.5:3000/api".
      
      // We'll try to request a non-existent endpoint which should return 404 or 401, indicating connectivity.
      // Using axios directly to bypass the interceptor for this test (though we want to test THIS url)
      await axios.get(`${serverUrl.replace(/\/$/, '')}/auth/me`, {
        timeout: 5000,
        validateStatus: (status) => status < 500 // Accept 401/404 as "connected"
      });
      
      setStatus('success');
      setMessage('Connection successful!');
    } catch (error) {
      console.error('Connection failed', error);
      setStatus('error');
      setMessage('Connection failed. Please check the URL and ensure the server is running.');
    }
  };

  const handleSave = () => {
    if (!serverUrl) {
      localStorage.removeItem('serverUrl');
    } else {
      // Ensure no trailing slash for consistency, though axios handles it usually
      const cleanUrl = serverUrl.replace(/\/$/, '');
      localStorage.setItem('serverUrl', cleanUrl);
    }
    navigate(-1); // Go back
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="h-16 border-b border-slate-200 flex items-center px-4 bg-white shrink-0 sticky top-0 z-10">
        <button 
          onClick={() => navigate(-1)}
          className="mr-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Server Configuration</h1>
      </div>

      <div className="flex-1 p-6 max-w-lg mx-auto w-full">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-4 text-purple-600 mb-2">
            <div className="p-3 bg-purple-50 rounded-xl">
              <Server size={24} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Server Connection</h2>
              <p className="text-sm text-slate-500">Configure where the app connects to</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Server URL</label>
            <input 
              type="url" 
              placeholder="http://192.168.1.x:3000/api"
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value);
                setStatus('idle');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all font-mono text-sm" 
            />
            <p className="text-xs text-slate-500">
              Enter the full URL including protocol and path (e.g., /api).
              Leave empty to use default.
            </p>
          </div>

          {status !== 'idle' && (
            <div className={`rounded-xl p-4 flex items-start gap-3 ${
              status === 'success' ? 'bg-green-50 text-green-700' : 
              status === 'error' ? 'bg-red-50 text-red-700' : 
              'bg-blue-50 text-blue-700'
            }`}>
              {status === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> :
               status === 'error' ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> :
               <Wifi size={18} className="mt-0.5 shrink-0 animate-pulse" />}
              <p className="text-sm">{message}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button 
              onClick={handleTestConnection}
              className="flex-1 py-3 rounded-xl border border-slate-200 font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <Wifi size={18} />
              Test
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 py-3 rounded-xl bg-purple-600 font-medium text-white hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-purple-200"
            >
              <Save size={18} />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
