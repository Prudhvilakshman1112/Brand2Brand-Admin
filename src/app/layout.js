import { createClient } from '@/lib/supabase/server';
import AdminLayoutClient from './AdminLayoutClient';
import './admin.css';

export const metadata = {
  title: 'Admin Dashboard | Brand 2 Brand',
  description: 'Manage products, categories, and store content.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If no user (login page), render just html/body without admin chrome
  if (!user) {
    return (
      <html lang="en">
        <body style={{ margin: 0, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <AdminLayoutClient user={user}>
          {children}
        </AdminLayoutClient>
      </body>
    </html>
  );
}
