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
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
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
            <Route path="/settings" element={<Settings />} />
            <Route path="/editor" element={<Editor />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
