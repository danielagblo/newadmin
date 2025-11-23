import ToastClient from '@/components/ui/ToastClient';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Oysloe Admin Panel',
  description: 'Admin panel for Oysloe Marketplace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ToastClient>{children}</ToastClient>
      </body>
    </html>
  );
}

