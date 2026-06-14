# Technical Configuration Reference

## Vercel Configuration Details

### Build Process Flow

```
1. Vercel detects push to main branch
2. Clones repository
3. Installs pnpm: pnpm install
4. Runs build command: pnpm run build
5. Process:
   ├── TypeScript compilation (all packages)
   ├── Frontend build (todo-app to dist/)
   ├── API server bundling (artifacts/api-server/dist/)
   └── Output: dist/ directory + api/index.ts
6. Deploys:
   ├── Static files from dist/ → CDN
   ├── api/index.ts → Serverless function
   └── Routes /api/* → api/index.ts
```

## File Structure for Deployment

```
Task-Manager-Pro/
├── dist/                              # Frontend static files (deployed to CDN)
│   ├── index.html
│   ├── assets/
│   │   ├── index-DjNhrQ92.css
│   │   └── index-JTRqBR1J.js
│   └── robots.txt
│
├── api/                               # Vercel serverless functions
│   ├── index.ts                       # Main API handler
│   └── tsconfig.json
│
├── artifacts/
│   ├── api-server/
│   │   ├── dist/                      # Built API server
│   │   │   └── index.mjs              # Main bundle
│   │   └── src/
│   │       ├── app.ts                 # Express app
│   │       └── routes/
│   └── todo-app/
│       ├── src/
│       │   ├── App.tsx
│       │   └── main.tsx
│       └── vite.config.ts
│
├── lib/                               # Shared libraries
│   ├── api-spec/
│   ├── api-zod/
│   ├── db/
│   └── api-client-react/
│
└── package.json                       # Root workspace config
```

## Environment Variables

```env
# ========== DATABASE ==========
DATABASE_URL=postgresql://[user:password]@[host]:[port]/[database]
  - User: Database user
  - Password: Database password
  - Host: Database server hostname/IP
  - Port: Database port (default 5432 for PostgreSQL)
  - Database: Database name

# ========== NODE ==========
NODE_ENV=production
  - Set to "production" on Vercel
  - Enables production optimizations
  - Disables verbose logging

# ========== CORS ==========
CORS_ORIGIN=https://yourdomain.vercel.app
  - Your Vercel deployment domain
  - Allows frontend to make API requests
  - Prevents CORS errors

# ========== API ==========
API_BASE_URL=https://yourdomain.vercel.app/api
  - Base URL for frontend API calls
  - Configure in frontend .env if needed
  - Optional: defaults to relative /api
```

## Vercel Functions Configuration

### api/index.ts Handler

```typescript
import app from "../artifacts/api-server/src/app";

export default app;
```

**How it works**:
1. Vercel detects `api/index.ts`
2. Wraps it as serverless function handler
3. Node.js 20.x runtime executes it
4. Incoming requests to `/api/*` → api/index.ts → Express app

### Request Flow

```
GET /api/tasks
    ↓
Vercel routing
    ↓
/api/* → /api (rewrite)
    ↓
api/index.ts (serverless function)
    ↓
Express app.use('/api', router)
    ↓
Task routes handler
    ↓
Response
```

## Build Commands Breakdown

### `pnpm run build`

```bash
# Step 1: Type check entire workspace
pnpm run typecheck
└── pnpm run typecheck:libs
    └── tsc --build
    
└── pnpm -r --filter artifacts/** --filter scripts
    ├── artifacts/api-server:     tsc --noEmit
    ├── artifacts/mockup-sandbox: tsc --noEmit  
    ├── artifacts/todo-app:       tsc --noEmit
    └── scripts:                  tsc --noEmit

# Step 2: Build all packages
pnpm -r --if-present run build
├── artifacts/mockup-sandbox: vite build
│   └── Outputs to dist/
├── artifacts/todo-app:       vite build
│   └── Outputs to ../../dist/
└── artifacts/api-server:     node ./build.mjs
    └── Outputs to dist/
```

## CORS Configuration

### Header Requirements

```http
GET /api/tasks HTTP/1.1
Host: yourdomain.vercel.app
Origin: https://yourdomain.vercel.app

Response Headers:
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

### Configured Routes

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        }
      ]
    }
  ]
}
```

## SPA Routing Configuration

### Rewrite Rules

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    }
  ]
}
```

**Purpose**: 
- API requests to `/api/*` are handled by `api/index.ts`
- Frontend can use relative URLs: `/api/tasks`
- Prevents 404 errors for nested routes

## Output Directory Mapping

### Vercel Deployment

```
dist/                    → Serves as root (/)
├── index.html          → /
├── assets/index-*.js   → /assets/index-*.js
└── assets/index-*.css  → /assets/index-*.css

api/index.ts           → /.vercel/functions/api.mjs
├── /api                → Routes here
└── /api/*              → Rewrites to /api
```

## Performance Metrics

### Current Bundle Sizes

| Component | Size | Gzip | Status |
|-----------|------|------|--------|
| mockup-sandbox.js | 187.72 kB | 59.51 kB | ✅ Good |
| mockup-sandbox.css | 89.09 kB | 14.77 kB | ✅ Good |
| todo-app.js | 589.08 kB | 183.69 kB | ⚠️ Large |
| todo-app.css | 94.82 kB | 15.59 kB | ✅ Good |
| api-server bundle | 1.3 MB | - | ✅ OK for serverless |

### Optimization Recommendations

1. **Code Splitting** (Priority: Medium)
   - Split todo-app into route chunks
   - Lazy load heavy components
   - Target: <150 kB main bundle

2. **Dead Code Elimination** (Priority: Low)
   - Audit unused dependencies
   - Remove unused UI components

3. **Compression** (Priority: Low)
   - Vercel automatically gzips responses
   - Already optimized

## Database Connection

### PostgreSQL Connection String Format

```
postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require&connect_timeout=10

Components:
- user: Database user name
- password: Database password (URL encode special chars)
- host: Server hostname (localhost in dev, cloud host in prod)
- port: Port number (5432 default)
- database: Database name
- sslmode=require: For cloud databases
- connect_timeout=10: Connection timeout in seconds
```

### Drizzle ORM Configuration

See `lib/db/drizzle.config.ts`:
```typescript
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Monitoring & Logs

### Vercel Dashboard

1. **Deployments Tab**
   - View deployment history
   - Check build logs
   - See deployment duration

2. **Logs Tab**
   - View function execution logs
   - See HTTP requests/responses
   - Error tracking

3. **Analytics Tab**
   - Request count
   - Response times
   - Geographic distribution

### Local Testing

```bash
# Install Vercel CLI
npm install -g vercel

# Build locally
vercel build

# Test with Vercel runtime
vercel dev
```

## Troubleshooting Checklist

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| Build fails | preinstall script | Already fixed with Node.js runner |
| API 404 errors | Missing api/index.ts | File exists at project root |
| CORS errors frontend | Missing headers | Vercel.json has CORS config |
| DB connection error | Wrong URL | Check DATABASE_URL env var |
| Blank frontend | Build path wrong | dist/ is correct output dir |
| Large bundle size | No code splitting | Consider vite config changes |

## Health Check URLs

After deployment, test these:

```bash
# Frontend loads
curl https://yourdomain.vercel.app/

# API is reachable
curl https://yourdomain.vercel.app/api/health

# Check status
curl -i https://yourdomain.vercel.app/api/health
```

Expected responses:
- Frontend: 200 OK with HTML
- API: 200 OK with JSON response
- Headers: Include CORS headers on API routes
