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
  id_verified?: boolean;
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

// Product Types (matching Django API schema)
export interface ProductOwner {
  id: number;
  email: string;
  phone: string;
  name: string;
}

export interface ProductLocation {
  id: number;
  region: string;
  name?: string | null;
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
  feature: Feature; // Feature object
  value: string;
}

export interface Product {
  id: number;
  pid: string;
  name: string;
  image?: string | null;
  category?: number | null;
  location?: ProductLocation; // ReadOnly
  type: 'SALE' | 'PAYLATER' | 'RENT';
  status: 'VERIFIED' | 'ACTIVE' | 'SUSPENDED' | 'DRAFT' | 'PENDING' | 'REJECTED';
  is_taken: boolean;
  description: string;
  price: string; // Decimal string
  duration: string;
  owner?: ProductOwner; // ReadOnly - ProductOwner object, not User
  images?: ProductImage[]; // ReadOnly
  product_features?: ProductFeature[]; // ReadOnly
  suspension_note?: string | null;
  created_at: string; // ReadOnly
  updated_at: string; // ReadOnly
}

// Product Report Types
export interface ProductReport {
  id: number;
  product?: Product | number;
  user?: User | number;
  reason: string;
  message?: string;
  created_at: string;
  updated_at: string;
}

// Location Types
export interface Location {
  id: number;
  name: string;
  region?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Review Types
export interface Review {
  id: number;
  user?: User;
  product?: Product;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
}

// Feedback Types
export interface Feedback {
  id: number;
  user?: User | number;
  // Optional rating (some feedback endpoints include a numeric rating)
  rating?: number;
  subject?: string;
  message: string;
  category?: string;
  status?: 'PENDING' | 'READ' | 'RESOLVED' | 'ARCHIVED';
  admin_response?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFeedbackForm {
  subject?: string;
  message: string;
  category?: string;
}

export interface UpdateFeedbackForm {
  status?: 'PENDING' | 'READ' | 'RESOLVED' | 'ARCHIVED';
  admin_response?: string;
}

// Product Feature Types
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
}

export interface Feature {
  id: number;
  subcategory: number;
  name: string;
  description?: string;
  possible_values: string[];
  created_at: string;
}

// Coupon Types
export interface Coupon {
  id: number;
  code: string;
  description?: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: string;
  min_purchase?: string;
  max_discount?: string;
  usage_limit?: number; // original API name for overall usage limit
  max_uses?: number; // optional alias used by frontend (max uses)
  per_user_limit?: number; // optional per-user limit
  used_count: number;
  remaining_uses?: number; // optional computed field used in UI
  is_active: boolean;
  valid_from: string;
  valid_until: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCouponForm {
  code: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: string;
  min_purchase?: string;
  max_discount?: string;
  usage_limit?: number;
  is_active?: boolean;
  valid_from: string;
  valid_until: string;
}

// Subscription Types
export interface Subscription {
  id: number;
  name: string;
  tier: 'BASIC' | 'BUSINESS' | 'PLATINUM';
  price: string; // Decimal string
  original_price?: string | null; // Decimal string, nullable
  discount_percentage?: string | null; // Decimal string, nullable
  multiplier?: string | null; // Decimal string, nullable (just a tag for differentiating plans)
  effective_price?: string; // ReadOnly - calculated effective price
  description?: string | null;
  features?: string; // Comma-separated list of features
  features_list?: string[]; // ReadOnly - array version of features
  duration_days: number;
  max_products?: number; // 0 for unlimited
  is_active: boolean;
  created_at: string; // ReadOnly
  updated_at: string; // ReadOnly
}

export interface CreateSubscriptionForm {
  name: string;
  tier: 'BASIC' | 'BUSINESS' | 'PLATINUM';
  price: string; // Decimal string
  original_price?: string | null;
  discount_percentage?: string | null; // Decimal string
  multiplier?: string | null; // Decimal string
  duration_days: number;
  description?: string | null;
  features?: string; // Comma-separated string
  max_products?: number; // 0 for unlimited
  is_active?: boolean;
}

export const SUBSCRIPTION_TIERS = ['BASIC', 'BUSINESS', 'PLATINUM'] as const;

// Chat Room Types
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
  // Optional feedback id this alert is related to (frontend/backends may store this)
  feedback?: number;
  is_read: boolean;
  created_at: string;
}

// Account Delete Request Types
export interface AccountDeleteRequest {
  id: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  admin_comment?: string | null;
  created_at: string;
  processed_at?: string | null;
}

// Job Application Types
export interface JobApplication {
  id: number;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  gender?: string;
  dob?: string; // ISO date
  resume?: string; // URL or path to resume file (pdf/docx)
  cover_letter?: string;
  created_at?: string;
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

// Payment Types
export interface Payment {
  id: number;
  user: number; // user id
  subscription?: number | null; // subscription id
  amount: string; // Decimal string
  currency: string;
  provider?: string;
  reference?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  channel?: string;
  raw_response?: any;
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
  password?: string;
  is_superuser?: boolean;
  is_staff?: boolean;
}

// Category Form Types
export interface CreateCategoryForm {
  name: string;
  description?: string;
}

export interface CreateSubCategoryForm {
  name: string;
  description?: string;
  category: number;
}

// User Level Constants
export const USER_LEVELS = ['SILVER', 'GOLD', 'DIAMOND'] as const;

// Discount Type Constants
export const DISCOUNT_TYPES = ['PERCENT', 'FIXED'] as const;

// Product Type Constants
export const PRODUCT_TYPES = ['SALE', 'PAYLATER', 'RENT'] as const;

// Product Status Constants (matching Django API ProductStatusEnum)
export const PRODUCT_STATUSES = ['VERIFIED', 'ACTIVE', 'SUSPENDED', 'DRAFT', 'PENDING', 'REJECTED'] as const;

// Region Constants
export const REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Eastern',
  'Central',
  'Volta',
  'Northern',
  'Upper East',
  'Upper West',
  'Brong Ahafo',
  'Western North',
  'Ahafo',
  'Bono',
  'Bono East',
  'Oti',
  'Savannah',
  'North East',
] as const;
