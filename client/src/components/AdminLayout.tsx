import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, ArrowLeft } from 'lucide-react';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState('admin/dashboard');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const syncCurrentPage = (path: string) => {
    if (path) {
      // Remove leading slash
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      setCurrentPage(cleanPath);
    }
  };

  useEffect(() => {
    syncCurrentPage(location.pathname);
  }, [location.pathname]);

  const handlePageChange = (page: string) => {
    setCurrentPage(page);
    navigate(`/${page}`);
  };

  const adminMenuItems = [
    { id: 'admin/dashboard', label: '概览', icon: LayoutDashboard },
    { id: 'admin/users', label: '用户管理', icon: Users },
    { id: 'dashboard', label: '返回应用', icon: ArrowLeft },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {!isMobile && (
        <Sidebar 
          currentPage={currentPage} 
          setCurrentPage={handlePageChange} 
          menuItems={adminMenuItems}
        />
      )}
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className={`flex-1 flex flex-col min-h-0 ${isMobile ? 'p-0 pb-20' : 'p-6'}`}>
          <Outlet />
        </div>
        
        {isMobile && (
          <MobileNav 
            currentPage={currentPage} 
            setCurrentPage={handlePageChange} 
            // MobileNav might also need menuItems update, but let's stick to Sidebar for now as MobileNav wasn't requested explicitly to be updated for admin, 
            // but for consistency we should probably update it too if it's easy.
            // Let's check MobileNav code first.
          />
        )}
      </main>
    </div>
  );
}
