import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, User, LogIn, AlertCircle, Activity } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (username === 'wolverine' && password === 'iNcorrectpAssword@123') {
        localStorage.setItem('gld_auth', 'true');
        onLogin();
      } else {
        setError('Invalid credentials. Access denied.');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <motion.div
          animate={{ x: [0, 80, -40, 0], y: [0, -60, 40, 0], scale: [1, 1.2, 0.9, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', top: '15%', left: '20%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15), transparent 70%)', filter: 'blur(60px)' }}
        />
        <motion.div
          animate={{ x: [0, -60, 50, 0], y: [0, 40, -30, 0], scale: [1, 0.8, 1.1, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', bottom: '10%', right: '15%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)', filter: 'blur(80px)' }}
        />
        <motion.div
          animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', top: '50%', left: '60%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.1), transparent 70%)', filter: 'blur(50px)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2.5rem',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-glass)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4), 0 0 100px rgba(139,92,246,0.08)',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{
              width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 1rem',
              background: 'linear-gradient(135deg, var(--accent), #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(139,92,246,0.3)'
            }}
          >
            <Activity size={32} color="white" />
          </motion.div>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.35rem' }}>
            Data Intelligence Hub
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Sign in to access your dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 2 }} />
            <input
              type="text"
              className="input-styled"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              style={{ paddingLeft: '2.8rem', height: '48px', fontSize: '0.95rem' }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 2 }} />
            <input
              type="password"
              className="input-styled"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ paddingLeft: '2.8rem', height: '48px', fontSize: '0.95rem' }}
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1rem', borderRadius: '10px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', fontSize: '0.85rem'
              }}
            >
              <AlertCircle size={16} /> {error}
            </motion.div>
          )}

          <motion.button
            type="submit"
            disabled={loading || !username || !password}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              width: '100%', height: '48px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, var(--accent), #3b82f6)',
              color: 'white', fontSize: '1rem', fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              opacity: loading || !username || !password ? 0.6 : 1,
              transition: 'opacity 0.2s',
              boxShadow: '0 4px 20px rgba(139,92,246,0.3)'
            }}
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <Lock size={18} />
              </motion.div>
            ) : (
              <><LogIn size={18} /> Sign In</>
            )}
          </motion.button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Authorized personnel only
        </p>
      </motion.div>
    </div>
  );
}
