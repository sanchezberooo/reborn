'use client'

import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = getSupabaseBrowser()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0a0a0a' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1
            className="font-display text-4xl font-semibold mb-2"
            style={{ color: '#c8a96e' }}
          >
            Reborn
          </h1>
          <p className="text-sm" style={{ color: '#5a5a5a' }}>
            Kişisel yaşam işletim sisteminiz
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: '#111111',
            border: '1px solid #1e1e1e',
            borderTop: '2px solid #c8a96e',
          }}
        >
          <h2
            className="font-display text-xl font-semibold mb-6"
            style={{ color: '#ececec' }}
          >
            Giriş Yap
          </h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: '#5a5a5a' }}>
                E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="sen@example.com"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: '#0a0a0a',
                  border: '1px solid #1e1e1e',
                  color: '#ececec',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#c8a96e')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#1e1e1e')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: '#5a5a5a' }}>
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: '#0a0a0a',
                  border: '1px solid #1e1e1e',
                  color: '#ececec',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#c8a96e')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#1e1e1e')}
              />
            </div>

            {error && (
              <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#2a0a0a', color: '#f87171' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 mt-2"
              style={{
                background: loading ? '#5a4a2e' : '#c8a96e',
                color: '#0a0a0a',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>

          {/* Sanchez hint */}
          <p className="text-center text-xs mt-6" style={{ color: '#2a2a2a' }}>
            Sanchez seni bekliyor.
          </p>
        </div>
      </div>
    </div>
  )
}
