import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorProvider, setGlobalErrorHandler, useError } from './contexts/ErrorContext';
import { ErrorModal } from './components/ErrorModal/ErrorModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Chat from './pages/Chat';
import KnowledgeGraph from './pages/KnowledgeGraph';

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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
            <Route path="/chat" element={<Chat />} />
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
