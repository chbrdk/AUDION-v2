import React, { useState } from 'react';
import { MsqdxLogo } from './MsqdxLogo';
import { t, Language } from '../translations';

interface LoginPanelProps {
  onLoginData: (email: string, password: string) => void;
  isLoading: boolean;
  error: string | null;
  lang: Language;
}

export function LoginPanel({ onLoginData, isLoading, error, lang }: LoginPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginData(email, password);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      height: '100%',
    }}>
      <div 
        className="msqdx-card"
        style={{
          padding: '32px 24px',
          backgroundColor: 'var(--msqdx-bg-card)',
          boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.08)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
            <MsqdxLogo height={24} />
          </div>
          <p style={{ color: 'var(--msqdx-text-secondary)', fontSize: '12px', marginTop: '8px' }}>
            {lang === 'de' ? 'Melde dich mit deinem Account an.' : 'Log in to your account.'}
          </p>
        </div>
        
        {error && (
          <div className="msqdx-mono" style={{
            padding: '12px',
            marginBottom: '20px',
            backgroundColor: 'rgba(220, 38, 38, 0.05)',
            border: '1px solid rgba(220, 38, 38, 0.15)',
            color: '#dc2626',
            borderRadius: '12px',
            fontSize: '10px',
            textAlign: 'center'
          }}>
            ERROR: {error.toUpperCase()}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
              {t('email', lang)}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(15, 23, 42, 0.03)',
                border: '1px solid var(--msqdx-border-color)',
                borderRadius: '10px',
                color: 'var(--msqdx-text-main)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="msqdx-mono" style={{ fontSize: '9px', fontWeight: '600', color: 'var(--msqdx-text-secondary)' }}>
              {t('password', lang)}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(15, 23, 42, 0.03)',
                border: '1px solid var(--msqdx-border-color)',
                borderRadius: '10px',
                color: 'var(--msqdx-text-main)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="msqdx-button"
            style={{
              padding: '12px',
              marginTop: '8px',
              height: '44px'
            }}
          >
            <span className="msqdx-mono" style={{ fontSize: '12px', fontWeight: '700' }}>
              {isLoading ? t('loggingIn', lang).toUpperCase() : t('login', lang).toUpperCase()}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
