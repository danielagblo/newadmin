# Troubleshooting Guide

## Admin Panel Not Showing Data from Production API

If your Next.js admin panel is not displaying data from your deployed Django API, follow these steps:

### 1. Check Environment Variables

**For Local Development:**
- Make sure `.env.local` exists in the `admin-panel` directory
- Verify it contains:
  ```env
  NEXT_PUBLIC_API_URL=https://api.oysloe.com
  NEXT_PUBLIC_API_BASE=/api-v1
  ```

**For Production Deployment (Vercel, Netlify, etc.):**
- Go to your deployment platform's environment variables settings
- Add these variables:
  - `NEXT_PUBLIC_API_URL` = `https://api.oysloe.com`
  - `NEXT_PUBLIC_API_BASE` = `/api-v1`
- **Important:** Redeploy your application after adding environment variables

### 2. Clear Browser Storage

If you previously logged in with localhost, your browser may have cached the old API token:

1. Open your browser's Developer Tools (F12)
2. Go to the **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Find **Local Storage** → your admin panel URL
4. Delete all items (especially `auth_token` and `user`)
5. Or simply log out and log in again

### 3. Verify API Connection

1. Open the Dashboard page
2. Check the browser console (F12 → Console tab)
3. Look for the "API Configuration" log message
4. Verify it shows: `https://api.oysloe.com/api-v1`

### 4. Check for Errors

The dashboard now shows error messages if there are connection issues:
- **401 Unauthorized**: Log out and log in again
- **404 Not Found**: Check if the API URL is correct
- **CORS Error**: Verify your Django backend allows requests from your admin panel domain

### 5. Restart Development Server

After changing `.env.local`:
```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

### 6. Rebuild for Production

If deploying to production, environment variables are embedded at build time:
```bash
npm run build
npm start
```

## Common Issues

### Issue: Still connecting to localhost:8000
**Solution:** 
- Check `.env.local` file exists and has correct values
- Restart the Next.js dev server
- Clear browser cache and localStorage

### Issue: Authentication errors
**Solution:**
- Clear localStorage (see step 2 above)
- Log out and log in again with production credentials
- Verify your admin user exists in the production database

### Issue: CORS errors
**Solution:**
- Verify Django `CORS_ALLOW_ALL_ORIGINS = True` in production settings
- Or add your admin panel domain to `CORS_ALLOWED_ORIGINS`

## Still Having Issues?

1. Check the browser console for detailed error messages
2. Check the Network tab to see what API requests are being made
3. Verify the production API is accessible: `curl https://api.oysloe.com/api-v1/products/`
4. Check Django server logs for any errors

