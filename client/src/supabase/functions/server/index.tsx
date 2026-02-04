import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const BUCKET_NAME = "make-afce5e5f-files";

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper: Get Supabase Admin Client
const getAdminClient = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Helper: Ensure Bucket Exists
const ensureBucket = async () => {
  const supabase = getAdminClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
  if (!bucketExists) {
    console.log(`Creating bucket: ${BUCKET_NAME}`);
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 52428800, // 50MB
    });
  }
};

// Middleware: Auth Check
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }
  
  const token = authHeader.split(' ')[1];
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return c.json({ error: 'Unauthorized', details: error?.message }, 401);
  }
  
  c.set('user', user);
  await next();
};

// Health check
app.get("/make-server-afce5e5f/health", (c) => {
  return c.json({ status: "ok" });
});

// --- Graph Routes ---

// Get Graph Data
app.get("/make-server-afce5e5f/graph", async (c) => {
  try {
    const data = await kv.get("graph_data");
    return c.json(data || { nodes: [], links: [] });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// Save Graph Data (Protected)
app.post("/make-server-afce5e5f/graph", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    await kv.set("graph_data", body);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// --- Document/Search Routes ---

// Create/Update Document (Protected)
app.post("/make-server-afce5e5f/documents", authMiddleware, async (c) => {
  try {
    const doc = await c.req.json();
    if (!doc.id) {
      doc.id = crypto.randomUUID();
    }
    // Store with prefix 'doc:'
    await kv.set(`doc:${doc.id}`, doc);
    return c.json(doc);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// List Documents
app.get("/make-server-afce5e5f/documents", async (c) => {
  try {
    const docs = await kv.getByPrefix("doc:");
    return c.json(docs);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// Search (Vector Search Simulation)
// NOTE: Real pgvector requires database extensions which cannot be enabled here.
// This implements a robust keyword/content search over the KV store.
app.post("/make-server-afce5e5f/search", async (c) => {
  try {
    const { query } = await c.req.json();
    if (!query) return c.json({ results: [] });

    const allDocs = await kv.getByPrefix("doc:");
    
    // Perform search (filtering)
    const lowerQuery = query.toLowerCase();
    const results = allDocs.filter((doc: any) => {
      const titleMatch = doc.title?.toLowerCase().includes(lowerQuery);
      const contentMatch = doc.content?.toLowerCase().includes(lowerQuery);
      const tagsMatch = doc.tags?.some((tag: string) => tag.toLowerCase().includes(lowerQuery));
      return titleMatch || contentMatch || tagsMatch;
    });

    return c.json({ results });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// --- File Storage Routes ---

// Upload File (Protected)
app.post("/make-server-afce5e5f/upload", authMiddleware, async (c) => {
  try {
    await ensureBucket();
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    const user = c.get('user');
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    
    const supabase = getAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true
      });

    if (error) throw error;

    // Create signed URL for immediate display if needed (valid for 1 hour)
    const { data: signedData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 3600);

    return c.json({ 
      path: filePath, 
      url: signedData?.signedUrl,
      fileName: file.name,
      size: file.size
    });

  } catch (err) {
    console.error("Upload error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// List Files (Protected)
app.get("/make-server-afce5e5f/files", authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const supabase = getAdminClient();
    
    // List files in user's folder
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(user.id);

    if (error) throw error;

    // Generate signed URLs for all files
    const filesWithUrls = await Promise.all(data.map(async (file) => {
      const { data: signedData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(`${user.id}/${file.name}`, 3600);
        
      return {
        ...file,
        url: signedData?.signedUrl
      };
    }));

    return c.json({ files: filesWithUrls });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

Deno.serve(app.fetch);
