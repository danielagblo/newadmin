# Oysloe Admin Panel

A comprehensive Next.js admin panel for managing the Oysloe Marketplace backend.

## Features

- 🔐 **Authentication**: Secure admin login with token-based authentication
- 📊 **Dashboard**: Overview statistics and key metrics
- 👥 **User Management**: Full CRUD operations for users with verification and activation
- 📦 **Product Management**: Manage products with status updates, images, and categorization
- 🗂️ **Category Management**: Organize products with categories and subcategories
- 📍 **Location Management**: Manage locations and regions
- 🎫 **Coupon Management**: Create and manage discount coupons
- ⭐ **Review Management**: View and manage product reviews
- 💬 **Chat Management**: Monitor chat rooms and messages
- 🔔 **Alert Management**: View and manage user alerts
- 📱 **Device Management**: Manage FCM device tokens

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API requests
- **Zustand** - Lightweight state management
- **React Hook Form** - Form handling
- **Lucide React** - Icon library
- **date-fns** - Date formatting utilities

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Django backend running (default: http://localhost:8000)

### Installation

1. Navigate to the admin panel directory:
```bash
cd admin-panel
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env.local` file in the `admin-panel` directory:
```env
# For production (deployed Django API):
NEXT_PUBLIC_API_URL=https://api.oysloe.com
NEXT_PUBLIC_API_BASE=/api-v1

# For local development:
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_API_BASE=/api-v1
```

**Important**: Make sure to set `NEXT_PUBLIC_API_URL` to your deployed Django API URL (e.g., `https://api.oysloe.com`) if you want to connect to the production backend. The admin panel will default to `http://localhost:8000` if this variable is not set.

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Login

Use your admin/staff credentials to log in. The admin panel requires staff or superuser privileges.

## Project Structure

```
admin-panel/
├── app/                    # Next.js app directory
│   ├── login/             # Login page
│   ├── users/             # User management
│   ├── products/          # Product management
│   ├── categories/        # Category management
│   ├── locations/         # Location management
│   ├── coupons/           # Coupon management
│   ├── reviews/           # Review management
│   ├── chatrooms/         # Chat room management
│   ├── alerts/            # Alert management
│   ├── devices/           # Device management
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── layout/           # Layout components (Sidebar, Header)
│   └── ui/               # Reusable UI components
├── lib/                   # Utilities and configurations
│   ├── api/              # API service files
│   ├── store/            # State management (Zustand)
│   └── types/            # TypeScript type definitions
└── public/               # Static assets
```

## API Integration

The admin panel connects to the Django REST API backend. All API calls are configured in `lib/api/`:

- `auth.ts` - Authentication endpoints
- `users.ts` - User management
- `products.ts` - Product management
- `categories.ts` - Category, SubCategory, Feature management
- `coupons.ts` - Coupon management
- `locations.ts` - Location management
- `reviews.ts` - Review management
- `chats.ts` - Chat room and message management
- `alerts.ts` - Alert management
- `devices.ts` - FCM device management

## Key Features

### Authentication
- Admin/staff login with token authentication
- Automatic token refresh and logout on 401 errors
- Protected routes with authentication checks

### Data Tables
- Sortable and filterable data tables
- Pagination support
- Search functionality
- Action buttons (Edit, Delete, Custom actions)

### Forms
- Modal-based forms for create/edit operations
- Form validation
- File upload support (images, avatars)
- Date/time pickers

### Status Management
- Toggle user active/inactive status
- Verify/unverify users
- Update product status (PENDING, ACTIVE, VERIFIED, etc.)
- Mark products as taken

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Django backend URL | `http://localhost:8000` |
| `NEXT_PUBLIC_API_BASE` | API base path | `/api-v1` |

## Building for Production

```bash
npm run build
npm start
```

## Troubleshooting

### CORS Issues
Ensure your Django backend has CORS configured to allow requests from `http://localhost:3000`:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]
```

### Authentication Issues
- Verify your admin credentials have `is_staff=True` or `is_superuser=True`
- Check that the token is being stored in localStorage
- Ensure the API URL is correct in `.env.local`

### API Connection Issues
- Verify the Django backend is running
- Check the API URL in `.env.local` matches your backend
- Ensure the API endpoints match the Django URL configuration

## License

This project is part of the Oysloe Marketplace system.

