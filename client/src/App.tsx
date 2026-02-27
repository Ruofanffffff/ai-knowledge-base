import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import Documents from './pages/Documents';
import { Graph } from './pages/Graph';
import { Community } from './pages/Community';
import { Settings } from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import DocumentDetail from './pages/DocumentDetail';
import CreateDocument from './pages/CreateDocument';
import { Editor } from './pages/Editor';
import { KnowledgeGrowth } from './pages/KnowledgeGrowth';
import { KnowledgeBodyDetail } from './pages/KnowledgeBodyDetail';
import { ServerConfig } from './pages/ServerConfig';
import { ProtectedRoute } from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import { AdminRoute } from './components/AdminRoute';
import { DashboardHome } from './pages/admin/DashboardHome';
import { UserManagement } from './pages/admin/UserManagement';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/server-config" element={<ServerConfig />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/documents/:id" element={<DocumentDetail />} />
            <Route path="/documents/new" element={<CreateDocument />} />
            <Route path="/graph" element={<Graph />} />
            <Route path="/community" element={<Community />} />
            <Route path="/knowledge-growth" element={<KnowledgeGrowth />} />
            <Route path="/knowledge-growth/:id" element={<KnowledgeBodyDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/editor" element={<Editor />} />
          </Route>
          
          <Route path="/admin" element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="dashboard" element={<DashboardHome />} />
              <Route path="users" element={<UserManagement />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
