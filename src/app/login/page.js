'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <div className="admin-login-page" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="admin-login-card">
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'var(--admin-accent)',
            borderRadius: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '18px',
            marginBottom: '16px',
          }}>
            B2B
          </div>
        </div>
        <h1>Admin Login</h1>
        <p>Sign in to manage your store</p>

        {error && <div className="admin-login-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="admin-form-group">
            <label className="admin-form-label">Email</label>
            <input
              type="email"
              className="admin-form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@brand2brand.com"
              required
              id="admin-login-email"
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Password</label>
            <input
              type="password"
              className="admin-form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              id="admin-login-password"
            />
          </div>
          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}
            disabled={loading}
            id="admin-login-submit"
          >
            {loading ? (
              <><span className="admin-spinner" style={{ width: 16, height: 16 }} /> Signing in...</>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
