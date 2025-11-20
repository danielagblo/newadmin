# Railway Deployment Setup

## Setting Environment Variables in Railway

Since your Next.js app is deployed on Railway, you need to set environment variables in Railway's dashboard (not in `.env.local`).

### Steps to Configure Environment Variables:

1. **Go to Railway Dashboard**
   - Visit [railway.app](https://railway.app)
   - Log in to your account
   - Select your Next.js project

2. **Navigate to Variables Tab**
   - Click on your service/project
   - Go to the **Variables** tab (or **Environment** tab)
   - This is where you'll add your environment variables

3. **Add Required Environment Variables**

   Add these two variables:

   | Variable Name | Value |
   |--------------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://api.oysloe.com` |
   | `NEXT_PUBLIC_API_BASE` | `/api-v1` |

4. **Redeploy Your Application**
   - After adding the variables, Railway will automatically trigger a new deployment
   - OR manually trigger a redeploy from the **Deployments** tab
   - Wait for the deployment to complete

5. **Verify the Deployment**
   - Once deployed, visit your Railway app URL
   - Open browser console (F12)
   - You should see: `API Configuration: { API_URL: "https://api.oysloe.com", ... }`
   - Try logging in - it should now connect to the production API

## Important Notes

- **Environment variables are case-sensitive** - Make sure to use exact names: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_BASE`
- **Redeploy is required** - Changes to environment variables require a new deployment
- **NEXT_PUBLIC_ prefix** - These variables are exposed to the browser, so they must start with `NEXT_PUBLIC_`
- **No quotes needed** - When adding values in Railway, don't include quotes around the values

## Troubleshooting

### Still seeing localhost:8000?
1. Verify the variables are set correctly in Railway dashboard
2. Check that a new deployment was triggered after adding variables
3. Clear your browser cache and localStorage
4. Check the browser console to see what API URL is being used

### Variables not showing up?
- Make sure you're adding them to the correct service/project
- Check that the variable names are exactly: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_BASE`
- Try manually triggering a redeploy after adding variables

### CORS Errors?
Make sure your Django backend at `https://api.oysloe.com` has CORS configured to allow requests from your Railway app domain.

## Quick Reference

**Railway Dashboard URL Pattern:**
```
https://railway.app/project/[your-project-id]/service/[your-service-id]/variables
```

**Required Variables:**
```env
NEXT_PUBLIC_API_URL=https://api.oysloe.com
NEXT_PUBLIC_API_BASE=/api-v1
```

