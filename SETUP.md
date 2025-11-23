# Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   cd admin-panel
   npm install
   ```

2. **Configure Environment**
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_API_BASE=/api-v1
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Access the Admin Panel**
   Open [http://localhost:3000](http://localhost:3000) in your browser

## Backend Requirements

Ensure your Django backend is running and accessible at the configured `NEXT_PUBLIC_API_URL`.

### CORS Configuration

Make sure your Django `settings.py` includes:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]

# Or for development:
CORS_ALLOW_ALL_ORIGINS = True
```

### Authentication

The admin panel uses token-based authentication. Admin users must have:
- `is_staff=True` or `is_superuser=True`
- Valid credentials for `/api-v1/adminlogin/` endpoint

## Available Pages

- **Dashboard** (`/`) - Overview statistics
- **Users** (`/users`) - User management
- **Products** (`/products`) - Product management
- **Categories** (`/categories`) - Category management
- **Locations** (`/locations`) - Location management
- **Coupons** (`/coupons`) - Coupon management
- **Reviews** (`/reviews`) - Review management
- **Chat Rooms** (`/chatrooms`) - Chat room monitoring
- **Alerts** (`/alerts`) - Alert management
- **Devices** (`/devices`) - FCM device management

## Features

### User Management
- List all users with search
- Create new users
- Edit user details
- Activate/Deactivate users
- Verify/Unverify users
- Delete users (soft delete)

### Product Management
- List products with pagination and search
- Create/Edit products
- Update product status
- Mark products as taken
- View product details
- Upload product images

### Category Management
- Create/Edit/Delete categories
- View subcategories
- Manage category hierarchy

### Location Management
- Create/Edit/Delete locations
- Filter by region
- Set active/inactive status

### Coupon Management
- Create/Edit/Delete coupons
- Set discount types (percent/fixed)
- Configure usage limits
- Set validity periods
- Expire coupons

## API Endpoints Used

The admin panel connects to these Django endpoints:

- `POST /api-v1/adminlogin/` - Admin login
- `POST /api-v1/logout/` - Logout
- `GET /api-v1/admin/users/` - List users
- `POST /api-v1/register/` - Create user
- `PUT /api-v1/userprofile/` - Update user
- `DELETE /api-v1/userprofile/` - Delete user
- `POST /api-v1/userprofile/` - Toggle user active status
- `POST /api-v1/admin/verifyuser/` - Verify user
- `GET /api-v1/products/` - List products
- `POST /api-v1/products/` - Create product
- `PUT /api-v1/products/{id}/` - Update product
- `PUT /api-v1/products/{id}/set-status/` - Update product status
- `POST /api-v1/products/{id}/mark-as-taken/` - Mark product as taken
- `GET /api-v1/categories/` - List categories
- `GET /api-v1/admin/categories/` - List categories with subcategories
- `GET /api-v1/locations/` - List locations
- `GET /api-v1/coupons/` - List coupons
- `GET /api-v1/reviews/` - List reviews
- `GET /api-v1/chatrooms/` - List chat rooms
- `GET /api-v1/alerts/` - List alerts
- `GET /notifications/devices/` - List FCM devices

## Troubleshooting

### Cannot Login
- Verify admin credentials have `is_staff=True`
- Check API URL in `.env.local`
- Ensure Django backend is running
- Check browser console for errors

### API Errors
- Verify CORS is configured correctly
- Check API endpoints match Django URLs
- Ensure authentication token is being sent
- Check network tab for request/response details

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Clear `.next` folder and rebuild: `rm -rf .next && npm run build`
- Check Node.js version (requires 18+)

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

3. Update environment variables for production:
   ```env
   NEXT_PUBLIC_API_URL=https://your-api-domain.com
   NEXT_PUBLIC_API_BASE=/api-v1
   ```

4. Configure your web server (Nginx, Apache, etc.) to proxy requests to the Next.js server.

## Notes

- The admin panel requires admin/staff privileges
- Some endpoints may need to be created in Django if they don't exist
- User creation uses the `/register/` endpoint - you may want to create a dedicated admin endpoint
- Product images are uploaded as multipart/form-data
- All dates are formatted using `date-fns`

