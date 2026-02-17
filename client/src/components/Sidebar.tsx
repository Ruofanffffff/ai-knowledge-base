import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, Network, Settings, Compass, Menu, X, Shield } from 'lucide-react';
import logo from '../assets/600cc0a2e59f846c93e6529bc524d2ae023eb689.png';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface StorageStats {
  usedFormatted: string;
  totalFormatted: string;
  percentage: number;
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
}

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  menuItems?: MenuItem[];
}

export function Sidebar({ currentPage, setCurrentPage, menuItems: customMenuItems }: SidebarProps) {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [storage, setStorage] = useState<StorageStats>({ usedFormatted: '—', totalFormatted: '—', percentage: 0 });

  useEffect(() => {
    apiClient.get('/storage/stats')
      .then(res => {
        const d = res.data;
        setStorage({ usedFormatted: d.usedFormatted, totalFormatted: d.totalFormatted, percentage: d.percentage });
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const defaultMenuItems = [
    { id: 'dashboard', label: 'Hi Brain', icon: LayoutDashboard },
    { id: 'documents', label: '思库', icon: FileText },
    { id: 'graph', label: '思链', icon: Network },
    { id: 'community', label: '思圈', icon: Compass },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  // If user is admin, add Admin Dashboard link to default menu items
  if (user?.role === 'admin') {
    // Check if it's already there to avoid duplicates
    if (!defaultMenuItems.some(item => item.id === 'admin/dashboard')) {
      defaultMenuItems.push({ 
        id: 'admin/dashboard', 
        label: '管理后台', 
        icon: Shield 
      });
    }
  }

  const menuItems = customMenuItems || defaultMenuItems;

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {isCollapsed && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <Menu size={24} className="text-slate-600" />
        </button>
      )}

      <div className={`
        fixed md:relative z-40 h-screen bg-white border-r border-slate-200 flex flex-col flex-shrink-0 transition-all duration-300
        ${isMobile ? (isCollapsed ? 'w-0' : 'w-64') : (isCollapsed ? 'w-0' : 'w-64')}
      `}>
        <div className="p-6 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
              <div className="flex flex-col text-center">
                <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 leading-tight">
                  BrainBase
                </span>
                <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 leading-tight">
                  拾思
                </span>
              </div>
            </div>
          )}
          {isCollapsed && !isMobile && (
            <div className="flex items-center justify-center w-full">
              <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            </div>
          )}
          {isMobile && !isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-600" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = currentPage === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id);
                  if (isMobile) setIsCollapsed(true);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-pink-50 to-blue-50 text-purple-700 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white shadow-sm text-purple-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                   <Icon size={20} />
                </div>
                {!isCollapsed && (
                  <>
                    <span className={`font-medium ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500" />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {!isCollapsed && (
          <div className="p-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">存储空间</div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2 overflow-hidden">
                <div className="bg-gradient-to-r from-pink-400 to-purple-500 h-1.5 rounded-full" style={{ width: `${storage.percentage}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{storage.usedFormatted}</span>
                <span>{storage.totalFormatted}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {isMobile && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={toggleSidebar}
        />
      )}
    </>
  );
}
