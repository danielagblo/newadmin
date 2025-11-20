// User Types
export interface User {
  id: number;
  email: string;
  phone: string;
  name: string;
  business_name?: string;
  id_number?: string;
  second_number?: string;
  business_logo?: string;
  id_front_page?: string;
  id_back_page?: string;
  account_number?: string;
  account_name?: string;
  mobile_network?: string;
  address?: string;
  avatar?: string;
  admin_verified: boolean;
  deleted: boolean;
  level: 'SILVER' | 'GOLD' | 'DIAMOND';
  referral_points: number;
  referral_code: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  created_from_app: boolean;
  phone_verified: boolean;
  email_verified: boolean;
  preferred_notification_email?: string;
  preferred_notification_phone?: string;
  active_ads?: number;
  taken_ads?: number;
  created_at: string;
  updated_at: string;
}

// Product Types
export interface Product {
  id: number;
  pid: string;
  name: string;
  image?: string;
  category?: number;
  location?: Location;
  type: 'SALE' | 'PAYLATER' | 'RENT';
  status: 'VERIFIED' | 'ACTIVE' | 'SUSPENDED' | 'DRAFT' | 'PENDING' | 'REJECTED';
  is_taken: boolean;
  description: string;
  price: string;
  duration: string;
  owner?: User;
  images?: ProductImage[];
  product_features?: ProductFeature[];
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: number;
  product: number;
  image: string;
  created_at: string;
}

export interface ProductFeature {
  id: number;
  product: number;
  feature: Feature;
  value: string;
}

// Category Types
export interface Category {
  id: number;
  name: string;
  description?: string;
  subcategories?: SubCategory[];
  created_at?: string; // Optional because AdminCategoryWithSubcategoriesSerializer doesn't include it
  updated_at?: string; // Optional because AdminCategoryWithSubcategoriesSerializer doesn't include it
}

export interface SubCategory {
  id: number;
  category: number;
  name: string;
  description?: string;
  features?: Feature[];
  created_at: string;
  updated_at: string;
}

export interface Feature {
  id: number;
  subcategory: number;
  name: string;
  description: string;
  possible_values?: string[]; // Predefined possible values for this feature
  values?: string[]; // Combined unique values (from ProductFeature + possible_values)
  created_at: string;
  updated_at: string;
}

// Location Types
export interface Location {
  id: number;
  region: string;
  name: string;
  description?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

// Review Types
export interface Review {
  id: number;
  product: Product;
  user: User;
  rating: number;
  comment?: string;
  created_at: string;
}

// Coupon Types
export interface Coupon {
  id: number;
  code: string;
  description?: string;
  discount_type: 'percent' | 'fixed';
  discount_value: string;
  max_uses?: number;
  uses: number;
  per_user_limit?: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  remaining_uses?: number;
  created_at: string;
  updated_at: string;
}

export interface CouponRedemption {
  id: number;
  coupon: Coupon;
  user: number;
  created_at: string;
}

// Chat Types
export interface ChatRoom {
  id: number;
  room_id: string;
  name: string;
  is_group: boolean;
  members: User[];
  messages?: Message[];
  total_unread?: number;
  created_at: string;
}

export interface Message {
  id: number;
  room: number;
  sender: User;
  content: string;
  is_read: boolean;
  created_at: string;
}

// Alert Types
export interface Alert {
  id: number;
  user?: User | number; // Optional, can be User object or user ID (number)
  title: string;
  body: string;
  kind?: string;
  is_read: boolean;
  created_at: string;
}

// FCM Device Types
export interface FCMDevice {
  id: number;
  user: number;
  token: string;
  created_at: string;
}

// Referral Types
export interface Referral {
  id: number;
  inviter: number;
  invitee: number;
  code: string;
  used_referral_code?: string;
  created_at: string;
  updated_at: string;
}

// Wallet Types
export interface Wallet {
  id: number;
  user: number;
  balance: string;
  created_at: string;
  updated_at: string;
}

// API Response Types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface ApiError {
  detail?: string;
  message?: string;
  error_message?: string;
  [key: string]: any;
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface CreateUserForm {
  email: string;
  phone: string;
  name: string;
  address?: string;
  avatar?: File;
  password: string;
  is_superuser?: boolean;
  is_staff?: boolean;
}

export interface UpdateUserForm {
  email?: string;
  phone?: string;
  name?: string;
  address?: string;
  avatar?: File;
  preferred_notification_email?: string;
  preferred_notification_phone?: string;
  is_superuser?: boolean;
  is_staff?: boolean;
}

export interface CreateProductForm {
  name: string;
  image?: File;
  category?: number;
  location?: number;
  type: 'SALE' | 'PAYLATER' | 'RENT';
  status?: 'VERIFIED' | 'ACTIVE' | 'SUSPENDED' | 'DRAFT' | 'PENDING' | 'REJECTED';
  description: string;
  price: string;
  duration?: string;
  owner?: number;
}

export interface CreateCategoryForm {
  name: string;
  description?: string;
}

export interface CreateSubCategoryForm {
  category: number;
  name: string;
  description?: string;
}

export interface CreateCouponForm {
  code: string;
  description?: string;
  discount_type: 'percent' | 'fixed';
  discount_value: string;
  max_uses?: number;
  per_user_limit?: number;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
}

export interface CreateLocationForm {
  region: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export const REGIONS: string[] = [
  'Ahafo',
  'Ashanti',
  'Bono East',
  'Brong Ahafo',
  'Central',
  'Eastern',
  'Greater Accra',
  'North East',
  'Northern',
  'Oti',
  'Savannah',
  'Upper East',
  'Upper West',
  'Volta',
  'Western',
  'Western North',
];

export const PRODUCT_TYPES = ['SALE', 'PAYLATER', 'RENT'] as const;
export const PRODUCT_STATUSES = ['VERIFIED', 'ACTIVE', 'SUSPENDED', 'DRAFT', 'PENDING', 'REJECTED'] as const;
export const USER_LEVELS = ['SILVER', 'GOLD', 'DIAMOND'] as const;
export const DISCOUNT_TYPES = ['percent', 'fixed'] as const;

