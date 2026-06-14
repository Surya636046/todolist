# Vercel Deployment Guide for Task-Manager-Pro

## Project Structure
This is a monorepo with the following structure:
- **Frontend**: `artifacts/todo-app` - React + Vite app
- **API Server**: `artifacts/api-server` - Express.js backend
- **API Routes**: `api/index.ts` - Vercel serverless functions entry point
- **UI Sandbox**: `artifacts/mockup-sandbox` - Component library showcase

## Deployment Setup

### 1. Prerequisites
- Vercel account (https://vercel.com)
- GitHub repository linked to Vercel
- Environment variables configured in Vercel dashboard

### 2. Environment Variables
Set these in your Vercel project settings:

```
DATABASE_URL=<your-database-url>
NODE_ENV=production
CORS_ORIGIN=<your-vercel-domain>
API_BASE_URL=<your-vercel-domain>/api
```

### 3. Build Process
The project uses pnpm workspaces and will:
1. Run `pnpm install` to install all dependencies
2. Run `pnpm run build` which:
   - Type-checks all code
   - Builds the todo-app (React frontend) to `dist/`
   - Builds the api-server for serverless execution
   - Creates the dist folder with static assets

### 4. Output Structure
After build:
- `dist/` - Static frontend files served by Vercel
- `artifacts/api-server/dist/` - API server bundle
- Routes under `/api/` are served by `api/index.ts` (Vercel serverless functions)

### 5. Key Features Configured

#### Frontend Routes
- Static files from `dist/` directory
- SPA routing handled by the frontend

#### API Routes
- Base path: `/api`
- Routes defined in `artifacts/api-server/src/routes/`
- Rewritten to single handler: `api/index.ts`

#### CORS Headers
- Automatically added to all `/api/` responses
- Allows requests from your Vercel domain

#### Database
- Uses Drizzle ORM for database operations
- Configure `DATABASE_URL` environment variable for production database

### 6. Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "chore: prepare for Vercel deployment"
   git push origin main
   ```

2. **Link to Vercel**
   - Go to https://vercel.com/new
   - Select your GitHub repository
   - Set project root to `.` (root directory)
   - Import project

3. **Configure Environment**
   - Add environment variables from `.env.example`
   - Set `DATABASE_URL` to your production database

4. **Deploy**
   - Click "Deploy"
   - Vercel will automatically:
     - Install dependencies with pnpm
     - Run the build script
     - Deploy frontend to CDN
     - Deploy API routes as serverless functions

### 7. Testing After Deployment

```bash
# Frontend
curl https://your-domain.vercel.app/

# API Health Check
curl https://your-domain.vercel.app/api/health

# API Routes
curl https://your-domain.vercel.app/api/tasks
```

### 8. Common Issues & Solutions

#### Issue: Build fails with "sh: command not found"
**Solution**: Already fixed in package.json preinstall script. Uses Node.js instead of shell script.

#### Issue: API routes not working
**Solution**: Ensure `api/index.ts` exists and properly exports the Express app. Vercel will wrap it automatically.

#### Issue: CORS errors from frontend
**Solution**: Check that `CORS_ORIGIN` environment variable matches your frontend domain.

#### Issue: Database connection errors
**Solution**: Verify `DATABASE_URL` is correct and accessible from Vercel's environment. Consider using allow-listing for IP addresses if using cloud database.

### 9. Development Locally

```bash
# Install dependencies
pnpm install

# Run development servers
# In terminal 1 (API)
cd artifacts/api-server && pnpm run dev

# In terminal 2 (Frontend)  
cd artifacts/todo-app && pnpm run dev
```

### 10. File Changes Made for Vercel

1. **package.json** - Fixed preinstall script for Windows compatibility
2. **vercel.json** - Updated with proper build configuration:
   - Framework: vite
   - Install command: pnpm install
   - Build command: pnpm run build
   - Output directory: dist
   - API functions configuration
   - CORS headers setup
   - Rewrites for SPA routing

3. **.vercelignore** - Excludes unnecessary files from deployment

4. **.env.example** - Template for environment variables

## Monitoring & Logs

After deployment, monitor your app:
- Go to your Vercel project dashboard
- View builds in the "Deployments" tab
- Check logs in the "Logs" section
- Monitor function performance in "Analytics"

## Next Steps

1. Deploy to Vercel
2. Configure your production database
3. Test the full workflow
4. Set up CI/CD if needed
5. Configure custom domain
6. Set up monitoring and alerts
