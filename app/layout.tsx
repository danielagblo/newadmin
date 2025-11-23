// Temporarily removed ToastClient to isolate client-side syntax error
// import ToastClient from '@/components/ui/ToastClient';
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
        {/* Use plain children while debugging ToastClient import errors */}
        {children}
      </body>
    </html>
  );
}

