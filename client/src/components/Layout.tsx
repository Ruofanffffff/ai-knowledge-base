import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useEffect, useState } from 'react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Sync currentPage with URL
  useEffect(() => {
    const path = location.pathname.slice(1); // Remove leading slash
    if (path) {
      setCurrentPage(path);
    }
  }, [location.pathname]);

  // Navigate when page changes
  const handlePageChange = (page: string) => {
    setCurrentPage(page);
    navigate(`/${page}`);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar currentPage={currentPage} setCurrentPage={handlePageChange} />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
