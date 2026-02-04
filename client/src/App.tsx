import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorProvider, setGlobalErrorHandler, useError } from './contexts/ErrorContext';
import { ErrorModal } from './components/ErrorModal/ErrorModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { DocumentsList } from './pages/DocumentsList';
import { Chat } from './pages/Chat';
import { Graph } from './pages/Graph';
import { Community } from './pages/Community';
import { Settings } from './pages/Settings';

function AppContent() {
  const { showError } = useError();

  useEffect(() => {
    // Set global error handler for API interceptors
    setGlobalErrorHandler(showError);
  }, [showError]);

  return (
    <>
      <ErrorModal />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard onNavigate={() => {}} />} />
            <Route path="/documents" element={<DocumentsList onNavigate={() => {}} />} />
            <Route path="/graph" element={<Graph />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/community" element={<Community />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ErrorProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ErrorProvider>
    </BrowserRouter>
  );
}

export default App;
