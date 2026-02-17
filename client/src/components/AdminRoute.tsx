import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

export function AdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // Check if user is logged in and has admin role
  if (!user || user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
