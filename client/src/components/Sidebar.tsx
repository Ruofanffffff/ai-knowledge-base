import React from 'react';
import { LayoutDashboard, FileText, Network, Settings, Compass } from 'lucide-react';
import logo from '../assets/600cc0a2e59f846c93e6529bc524d2ae023eb689.png';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export function Sidebar({ currentPage, setCurrentPage }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: '概览', icon: LayoutDashboard },
    { id: 'documents', label: '文档', icon: FileText },
    { id: 'graph', label: '知识图谱', icon: Network },
    { id: 'community', label: '创造社区', icon: Compass },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  return (
    <div className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
      <div className="p-6 flex items-center gap-3">
        <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
        <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500">
          BrainBase
        </span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = currentPage === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-pink-50 to-blue-50 text-purple-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white shadow-sm text-purple-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                 <Icon size={20} />
              </div>
              <span className={`font-medium ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">存储空间</div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2 overflow-hidden">
            <div className="bg-gradient-to-r from-pink-400 to-purple-500 h-1.5 rounded-full w-[75%]" />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>7.5 GB</span>
            <span>10 GB</span>
          </div>
        </div>
      </div>
    </div>
  );
}
