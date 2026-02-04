# Deployment Guide

This guide provides instructions for deploying the AI Knowledge Base frontend to production.

## Prerequisites

- Node.js 18+ installed
- Backend server deployed and accessible
- Production domain configured
- SSL certificate configured (HTTPS required)

---

## Environment Configuration

### 1. Update Production Environment Variables

Edit `.env.production` file:

```bash
# API Configuration - REQUIRED
VITE_API_BASE_URL=https://your-production-domain.com/api

# Auto-Refresh Configuration
VITE_ENABLE_AUTO_REFRESH=true
VITE_AUTO_REFRESH_INTERVAL=60000

# Debug Mode - MUST BE FALSE IN PRODUCTION
VITE_DEBUG_MODE=false
```

**Important**: Replace `https://your-production-domain.com/api` with your actual production API URL.

---

## Build Process

### 1. Install Dependencies

```bash
cd client
npm install
```

### 2. Run Production Build

```bash
npm run build
```

This will:
- Compile TypeScript to JavaScript
- Bundle all assets with Vite
- Minify and optimize code
- Generate production-ready files in `dist/` directory

### 3. Verify Build Output

Check that the `dist/` directory contains:
- `index.html` - Main HTML file
- `assets/` - JavaScript and CSS bundles
- Source maps (for debugging)

---

## Deployment Options

### Option 1: Static Hosting (Recommended)

Deploy the `dist/` directory to any static hosting service:

#### Vercel
```bash
npm install -g vercel
cd client
vercel --prod
```

#### Netlify
```bash
npm install -g netlify-cli
cd client
netlify deploy --prod --dir=dist
```

#### AWS S3 + CloudFront
```bash
# Upload dist/ to S3 bucket
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Option 2: Docker Container

Create `Dockerfile` in client directory:

```dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Build and run:

```bash
docker build -t knowledge-base-frontend .
docker run -p 80:80 knowledge-base-frontend
```

### Option 3: Traditional Web Server

#### Apache

1. Copy `dist/` contents to web root (e.g., `/var/www/html`)
2. Create `.htaccess`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### Nginx

1. Copy `dist/` contents to web root (e.g., `/usr/share/nginx/html`)
2. Update nginx config:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Backend Configuration

### 1. CORS Configuration

Ensure backend allows requests from your frontend domain:

```javascript
// server.js
const cors = require('cors');

app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

### 2. API Endpoints

Verify all API endpoints are accessible:
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/documents`
- `GET /api/knowledge-graph/entities`
- `GET /api/knowledge-graph/relations`
- `POST /api/ai/search`
- `POST /api/upload`

### 3. SSL/TLS Configuration

**Required**: Production must use HTTPS for security.

- Obtain SSL certificate (Let's Encrypt, AWS Certificate Manager, etc.)
- Configure web server to use HTTPS
- Redirect HTTP to HTTPS

---

## Post-Deployment Verification

### 1. Smoke Tests

Visit your production URL and verify:
- [ ] Frontend loads without errors
- [ ] Login page displays correctly
- [ ] Can log in with valid credentials
- [ ] Dashboard loads after login
- [ ] API calls succeed (check Network tab)

### 2. Browser Console Check

Open browser DevTools Console:
- [ ] No JavaScript errors
- [ ] No 404 errors for assets
- [ ] API calls return 200 status codes

### 3. Network Tab Check

Open browser DevTools Network tab:
- [ ] All assets load successfully
- [ ] API calls use correct production URL
- [ ] Authorization headers included in requests
- [ ] CORS headers present in responses

### 4. Performance Check

- [ ] Page load time < 3 seconds
- [ ] Time to Interactive < 5 seconds
- [ ] No console warnings about large bundles

---

## Monitoring and Maintenance

### 1. Error Tracking

Consider integrating error tracking:
- Sentry
- LogRocket
- Rollbar

### 2. Analytics

Consider adding analytics:
- Google Analytics
- Mixpanel
- Amplitude

### 3. Performance Monitoring

Monitor key metrics:
- Page load time
- API response time
- Error rates
- User engagement

---

## Rollback Procedure

If deployment fails:

1. **Revert to previous version**
   ```bash
   # For static hosting
   git checkout previous-tag
   npm run build
   # Deploy dist/ directory
   ```

2. **Check backend compatibility**
   - Verify API endpoints match frontend expectations
   - Check for breaking changes

3. **Review logs**
   - Check browser console errors
   - Check backend server logs
   - Check CDN/hosting logs

---

## Troubleshooting

### Issue: Blank Page After Deployment

**Cause**: Incorrect base path or routing configuration

**Solution**:
1. Check browser console for errors
2. Verify `index.html` loads correctly
3. Check routing configuration in `App.tsx`
4. Ensure web server redirects all routes to `index.html`

### Issue: API Calls Fail

**Cause**: CORS or incorrect API URL

**Solution**:
1. Verify `VITE_API_BASE_URL` in `.env.production`
2. Check CORS configuration on backend
3. Verify backend is accessible from frontend domain
4. Check Network tab for actual API URLs being called

### Issue: Authentication Not Working

**Cause**: Token storage or CORS credentials

**Solution**:
1. Check localStorage for `auth_token`
2. Verify CORS allows credentials
3. Check Authorization header in API requests
4. Verify backend JWT validation

### Issue: Assets Not Loading

**Cause**: Incorrect asset paths or CDN configuration

**Solution**:
1. Check Network tab for 404 errors
2. Verify asset paths in build output
3. Check CDN configuration if using one
4. Ensure base path is configured correctly

---

## Security Checklist

Before going live:

- [ ] HTTPS enabled and enforced
- [ ] Debug mode disabled (`VITE_DEBUG_MODE=false`)
- [ ] No sensitive data in client-side code
- [ ] API keys not exposed in frontend
- [ ] CORS properly configured (not `*`)
- [ ] Content Security Policy configured
- [ ] XSS protection enabled
- [ ] CSRF protection enabled on backend

---

## Performance Optimization

### Code Splitting

Consider implementing dynamic imports for large pages:

```typescript
// Instead of:
import KnowledgeGraph from './pages/KnowledgeGraph';

// Use:
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph'));
```

### Asset Optimization

- Compress images (WebP format)
- Enable gzip/brotli compression
- Use CDN for static assets
- Implement caching headers

### Bundle Size Reduction

```bash
# Analyze bundle size
npm run build -- --mode production
npx vite-bundle-visualizer
```

---

## Support and Resources

- **Documentation**: See `README.md`, `API_INTEGRATION.md`, `TESTING.md`
- **Manual Testing**: See `MANUAL_TESTING_GUIDE.md`
- **Backend API**: See backend `kg/API.md`

---

## Deployment Checklist

Use this checklist for each deployment:

```
## Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Backend deployed and accessible
- [ ] SSL certificate valid

## Deployment
- [ ] Dependencies installed
- [ ] Production build successful
- [ ] Assets uploaded to hosting
- [ ] DNS configured correctly
- [ ] CORS configured on backend

## Post-Deployment
- [ ] Frontend loads without errors
- [ ] Login functionality works
- [ ] API calls succeed
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Error tracking configured
- [ ] Monitoring enabled

## Rollback Plan
- [ ] Previous version tagged
- [ ] Rollback procedure documented
- [ ] Team notified of deployment
```

---

**Last Updated**: 2026-02-04
