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
  owner: string | User;
  created_at: string;
  updated_at: string;
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
}

export interface Feature {
  id: number;
  subcategory: number;
  name: string;
  description?: string;
  possible_values: string[];
  created_at: string;
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

// Coupon Types
export interface Coupon {
  id: number;
  code: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: number;
  min_purchase?: number;
  max_discount?: number;
  usage_limit?: number;
  used_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
  created_at: string;
  updated_at: string;
}

// Review Types
export interface Review {
  id: number;
  product: number | Product;
  user: number | User;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
}

// Alert Types
export interface Alert {
  id: number;
  title: string;
  body: string;
  kind: string;
  user: User | number | undefined;
  read: boolean;
  is_read?: boolean; // Alias for read
  created_at: string;
}

// Chat Types
export interface ChatRoom {
  id: number;
  name?: string;
  type: 'DIRECT' | 'GROUP';
  members: (User | number)[];
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  chatroom: number | ChatRoom;
  sender: number | User;
  content: string;
  read: boolean;
  created_at: string;
}

// Subscription Types
export interface Subscription {
  id: number;
  name: string;
  tier: 'BASIC' | 'BUSINESS' | 'PLATINUM';
  price: number;
  original_price?: number;
  discount_percentage?: number;
  multiplier?: number;
  duration_days: number;
  description?: string;
  features: string[];
  max_ads?: number;
  max_products?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriptionForm {
  name: string;
  tier: 'BASIC' | 'BUSINESS' | 'PLATINUM';
  price: number;
  original_price?: number;
  discount_percentage?: number;
  multiplier?: number;
  duration_days: number;
  description?: string;
  features: string[];
  max_ads?: number;
  max_products?: number;
  is_active: boolean;
}

// Feedback Types
export interface Feedback {
  id: number;
  user: number | User;
  subject: string;
  message: string;
  category: 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'COMPLAINT' | 'OTHER';
  status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
  admin_response?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFeedbackForm {
  subject: string;
  message: string;
  category: 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'COMPLAINT' | 'OTHER';
}

export interface UpdateFeedbackForm {
  status?: 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
  admin_response?: string;
  admin_notes?: string;
}

// Form Types
export interface CreateUserForm {
  email: string;
  phone: string;
  name: string;
  password: string;
  address?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
}

export interface UpdateUserForm {
  email?: string;
  phone?: string;
  name?: string;
  address?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
}

export interface CreateCategoryForm {
  name: string;
  description?: string;
}

export interface CreateSubCategoryForm {
  name: string;
  description?: string;
  category: number;
}

export interface CreateCouponForm {
  code: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: number;
  min_purchase?: number;
  max_discount?: number;
  usage_limit?: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
}

// Pagination Types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Constants
export const USER_LEVELS = ['SILVER', 'GOLD', 'DIAMOND'] as const;
export const SUBSCRIPTION_TIERS = ['BASIC', 'BUSINESS', 'PLATINUM'] as const;
export const FEEDBACK_CATEGORIES = ['BUG', 'FEATURE', 'IMPROVEMENT', 'COMPLAINT', 'OTHER'] as const;
export const FEEDBACK_STATUSES = ['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED'] as const;
export const DISCOUNT_TYPES = ['PERCENT', 'FIXED'] as const;
export const PRODUCT_TYPES = ['SALE', 'PAYLATER', 'RENT'] as const;
export const PRODUCT_STATUSES = ['VERIFIED', 'ACTIVE', 'SUSPENDED', 'DRAFT', 'PENDING', 'REJECTED'] as const;
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
  'North East',
  'Savannah',
] as const;
