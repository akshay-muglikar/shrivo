# Azure App Service Deployment

This repo should be deployed to Azure as three separate services:

1. Frontend App Service
2. Backend App Service
3. Azure Database for PostgreSQL Flexible Server

Do not try to deploy `docker-compose.prod.yml` directly to a single App Service. The compose file assumes an internal `backend` hostname that only exists inside Docker Compose.

## Recommended Architecture

- Frontend: Azure App Service for Containers
- Backend: Azure App Service for Containers
- Database: Azure Database for PostgreSQL Flexible Server

## 1. Create Azure Database for PostgreSQL

Create a PostgreSQL Flexible Server and note:

- host
- database name
- username
- password
- SSL requirement

Use a connection string like:

```env
postgresql+asyncpg://USERNAME:PASSWORD@HOST:5432/DATABASE?ssl=require
```

Set that as `DATABASE_URL` on the backend App Service.

## 2. Deploy the Backend App Service

Create a Linux Web App using the backend Docker image from `backend/Dockerfile`.

Backend App Settings:

```env
DATABASE_URL=postgresql+asyncpg://USERNAME:PASSWORD@HOST:5432/DATABASE?ssl=require
SECRET_KEY=replace-with-a-long-random-secret
ENVIRONMENT=production
PORT=8000
ACCESS_TOKEN_EXPIRE_DAYS=30
CORS_ORIGINS=["https://YOUR-FRONTEND-NAME.azurewebsites.net"]
TIMEZONE=Asia/Kolkata
```

Important notes:

- The backend container already runs `alembic upgrade head` on startup.
- Health endpoint is `/health`.
- The app listens on `PORT=8000`, which matches the Dockerfile.

## 3. Deploy the Frontend App Service

Create a second Linux Web App using the frontend Docker image from `frontend/Dockerfile`.

At build time, pass the backend API base URL:

```env
VITE_API_BASE_URL=https://YOUR-BACKEND-NAME.azurewebsites.net/api/v1
```

Because the frontend is a Vite build, `VITE_API_BASE_URL` must be available during image build, not only at runtime.

If you build with Azure Container Registry or GitHub Actions, pass it as a Docker build argument:

```bash
docker build \
  -f frontend/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://YOUR-BACKEND-NAME.azurewebsites.net/api/v1 \
  -t your-registry.azurecr.io/inventory-frontend:latest \
  ./frontend
```

## 4. Suggested Deployment Flow

### Backend image

```bash
docker build -f backend/Dockerfile -t your-registry.azurecr.io/inventory-backend:latest ./backend
docker push your-registry.azurecr.io/inventory-backend:latest
```

### Frontend image

```bash
docker build \
  -f frontend/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://YOUR-BACKEND-NAME.azurewebsites.net/api/v1 \
  -t your-registry.azurecr.io/inventory-frontend:latest \
  ./frontend
docker push your-registry.azurecr.io/inventory-frontend:latest
```

Then point each Azure App Service at the correct container image.

## 5. App Service Configuration Checklist

Backend:

- Startup container exposes port `8000`
- App setting `WEBSITES_PORT=8000`
- Add all backend environment variables

Frontend:

- Nginx serves on port `80`
- App setting `WEBSITES_PORT=80`
- Rebuild the image whenever `VITE_API_BASE_URL` changes

## 6. CORS

Set backend `CORS_ORIGINS` to the exact frontend URL, for example:

```env
["https://shrivo.azurewebsites.net"]
```

If you later add a custom domain, update `CORS_ORIGINS` accordingly.

## 7. First Deployment Validation

After deployment, verify:

1. Backend health works at `https://YOUR-BACKEND-NAME.azurewebsites.net/health`
2. Frontend loads successfully
3. Login requests reach the backend
4. API calls succeed from the browser without CORS errors
5. Backend logs show Alembic migrations completed successfully

## 8. Important Limitation

The current frontend image still contains an Nginx `/api/` proxy block intended for Docker Compose. That is not required once `VITE_API_BASE_URL` points directly at the backend App Service. Browser requests will go directly to the backend URL.

## 9. Recommended Azure Services Summary

- Frontend: Azure App Service
- Backend: Azure App Service
- Database: Azure Database for PostgreSQL Flexible Server
- Container registry: Azure Container Registry
