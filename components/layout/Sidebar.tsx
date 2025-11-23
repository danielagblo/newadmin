'use client';

import clsx from 'clsx';
import {
  Bell,
  CreditCard,
  FileText,
  FolderTree,
  LayoutDashboard,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Package,
  Shield,
  Ticket,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Admin Users', href: '/admin-users', icon: Shield },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Categories', href: '/categories', icon: FolderTree },
  { name: 'Locations', href: '/locations', icon: MapPin },
  { name: 'Coupons', href: '/coupons', icon: Ticket },
  { name: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Reviews', href: '/reviews', icon: MessageSquare },
  { name: 'Chat Rooms', href: '/chatrooms', icon: MessageSquare },
  { name: 'Messages', href: '/messages', icon: Mail },
  { name: 'Feedback', href: '/feedback', icon: MessageCircle },
  { name: 'Account Delete Requests', href: '/account-delete-requests', icon: Users },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Terms and Conditions', href: '/terms', icon: FileText },
  { name: 'Privacy Policy', href: '/privacy', icon: Lock },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <div className="flex flex-col w-64 bg-gray-900 text-white h-screen">
      <div className="flex items-center justify-center h-16 bg-gray-800">
        <h1 className="text-xl font-bold">Oysloe Admin</h1>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

