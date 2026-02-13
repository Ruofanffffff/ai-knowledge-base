import React from 'react';
import { LayoutDashboard, FileText, Network, Settings, Compass } from 'lucide-react';

interface MobileNavProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export function MobileNav({ currentPage, setCurrentPage }: MobileNavProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Hi Brain', icon: LayoutDashboard },
    { id: 'documents', label: '思库', icon: FileText },
    { id: 'graph', label: '思链', icon: Network },
    { id: 'community', label: '思圈', icon: Compass },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-4 pb-safe pt-2 md:hidden">
      <div className="flex justify-around items-center h-16">
        {menuItems.map((item) => {
          const isActive = currentPage === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-purple-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${isActive ? 'bg-purple-50' : ''}`}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-purple-600' : 'text-slate-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
