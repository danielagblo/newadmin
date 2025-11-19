# Production API Configuration

## Production API Endpoints

Your production API is available at:
- **API Base:** https://api.oysloe.com/api-v1/
- **API Docs:** https://api.oysloe.com/api/docs/
- **Ping Endpoint:** https://api.oysloe.com/api-v1/ ✅ (returns `{"message":"pong"}`)

## Switching to Production API

### Option 1: Update .env.local (Quick Test)

Edit `admin-panel/.env.local`:
```env
NEXT_PUBLIC_API_URL=https://api.oysloe.com
NEXT_PUBLIC_API_BASE=/api-v1
```

Then restart the Next.js server.

### Option 2: Use Production Build

1. Build for production:
   ```bash
   cd admin-panel
   npm run build
   ```

2. Set environment variables:
   ```bash
   export NEXT_PUBLIC_API_URL=https://api.oysloe.com
   export NEXT_PUBLIC_API_BASE=/api-v1
   ```

3. Start production server:
   ```bash
   npm start
   ```

### Option 3: Deploy with Environment Variables

When deploying (Vercel, Netlify, etc.), set these environment variables:
- `NEXT_PUBLIC_API_URL=https://api.oysloe.com`
- `NEXT_PUBLIC_API_BASE=/api-v1`

## Verified Endpoints

Based on the API structure, these endpoints should be available:

### Authentication
- ✅ `POST https://api.oysloe.com/api-v1/adminlogin/`
- ✅ `POST https://api.oysloe.com/api-v1/logout/`
- ✅ `GET https://api.oysloe.com/api-v1/userprofile/`

### Users
- ✅ `GET https://api.oysloe.com/api-v1/admin/users/`
- ✅ `POST https://api.oysloe.com/api-v1/admin/verifyuser/`

### Products
- ✅ `GET https://api.oysloe.com/api-v1/products/`
- ✅ `POST https://api.oysloe.com/api-v1/products/`
- ✅ `PUT https://api.oysloe.com/api-v1/products/{id}/set-status/`

### Categories
- ✅ `GET https://api.oysloe.com/api-v1/categories/`
- ✅ `GET https://api.oysloe.com/api-v1/admin/categories/`

### Other Resources
- ✅ `GET https://api.oysloe.com/api-v1/locations/`
- ✅ `GET https://api.oysloe.com/api-v1/coupons/`
- ✅ `GET https://api.oysloe.com/api-v1/reviews/`
- ✅ `GET https://api.oysloe.com/api-v1/chatrooms/`
- ✅ `GET https://api.oysloe.com/api-v1/alerts/`
- ✅ `GET https://api.oysloe.com/notifications/devices/`

## API Documentation

Full API documentation is available at:
**https://api.oysloe.com/api/docs/**

This is a Swagger UI interface where you can:
- View all available endpoints
- Test API calls
- See request/response schemas
- Understand authentication requirements

## CORS Configuration

Make sure your production Django backend has CORS configured to allow requests from your admin panel domain:

```python
CORS_ALLOWED_ORIGINS = [
    "https://your-admin-panel-domain.com",
    "http://localhost:3001",  # For local testing
]
```

## Testing Production Connection

1. Update `.env.local` with production URL
2. Restart Next.js server
3. Try logging in with production admin credentials
4. Check browser console for any CORS or connection errors

## Notes

- The production API uses HTTPS, so make sure SSL certificates are valid
- Authentication tokens from production will be different from local
- Some endpoints may require different permissions in production
- Always test in a staging environment before deploying to production

