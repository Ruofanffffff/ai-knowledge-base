import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './supabase/info';

// Initialize Supabase Client
const supabaseUrl = `https://${projectId}.supabase.co`;
export const supabase = createClient(supabaseUrl, publicAnonKey);

// Server Base URL
const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-afce5e5f`;

// Helper: Get Auth Headers
const getHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
};

// --- API Functions ---

// 1. Graph Data
export const getGraphData = async () => {
  try {
    const response = await fetch(`${SERVER_URL}/graph`, {
      method: 'GET',
      headers: await getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch graph data');
    return await response.json();
  } catch (error) {
    console.error('Graph fetch error:', error);
    return { nodes: [], links: [] };
  }
};

export const saveGraphData = async (data: any) => {
  const response = await fetch(`${SERVER_URL}/graph`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to save graph data');
  return await response.json();
};

// 2. Documents & Search
export const getDocuments = async () => {
  const response = await fetch(`${SERVER_URL}/documents`, {
    method: 'GET',
    headers: await getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch documents');
  return await response.json();
};

export const saveDocument = async (doc: any) => {
  const response = await fetch(`${SERVER_URL}/documents`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify(doc),
  });
  if (!response.ok) throw new Error('Failed to save document');
  return await response.json();
};

export const searchDocuments = async (query: string) => {
  const response = await fetch(`${SERVER_URL}/search`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error('Search failed');
  return await response.json();
};

// 3. File Storage
export const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${SERVER_URL}/upload`, {
    method: 'POST',
    headers, // Content-Type is set automatically by fetch for FormData
    body: formData,
  });

  if (!response.ok) throw new Error('Upload failed');
  return await response.json();
};

export const getFiles = async () => {
  const response = await fetch(`${SERVER_URL}/files`, {
    method: 'GET',
    headers: await getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch files');
  return await response.json();
};

// 4. Real-time Subscription
export const subscribeToGraph = (callback: (data: any) => void) => {
  const channel = supabase
    .channel('graph-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'kv_store_afce5e5f',
        filter: 'key=eq.graph_data',
      },
      (payload: any) => {
        // payload.new contains the updated row { key: "graph_data", value: {...} }
        if (payload.new && payload.new.value) {
          callback(payload.new.value);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
