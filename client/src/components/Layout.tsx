import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useEffect, useState } from 'react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState('dashboard');
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
      setCurrentPage(path);
    }
  };

  useEffect(() => {
    const path = location.pathname.slice(1);
    syncCurrentPage(path);
  }, [location.pathname]);

  const handlePageChange = (page: string) => {
    setCurrentPage(page);
    navigate(`/${page}`);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {!isMobile && <Sidebar currentPage={currentPage} setCurrentPage={handlePageChange} />}
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className={`flex-1 flex flex-col min-h-0 ${isMobile ? 'p-0 pb-20' : 'p-6'}`}>
          <Outlet />
        </div>
        
        {isMobile && <MobileNav currentPage={currentPage} setCurrentPage={handlePageChange} />}
      </main>
    </div>
  );
}
