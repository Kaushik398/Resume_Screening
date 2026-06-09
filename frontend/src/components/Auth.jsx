import { useState } from 'react'
import { supabase, isDemoMode } from '../supabase'

export default function Auth({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!email.trim() || !password) {
      setError('Please fill in all fields.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (signUpError) throw signUpError

        if (data?.session) {
          onAuthSuccess(data.session)
        } else {
          setSuccessMsg('Registration successful! Please check your email to confirm.')
          setIsSignUp(false)
          setPassword('')
          setConfirmPassword('')
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError
        if (data?.session) {
          onAuthSuccess(data.session)
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred during authentication.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = () => {
    // Simulates OAuth flow locally
    setLoading(true)
    setTimeout(() => {
      const user = { id: `google-usr-${Math.random().toString(36).substr(2, 9)}`, email: 'google.user@company.com' }
      const session = {
        access_token: `demo-token-${btoa(JSON.stringify(user))}`,
        user,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }
      localStorage.setItem('demo_session', JSON.stringify(session))
      onAuthSuccess(session)
      setLoading(false)
    }, 1200)
  }

  return (
    <div className="landing-layout">
      {/* Top Header Logo */}
      <header className="landing-top-bar">
        <div className="logo-group">
          <span className="logo-icon">💠</span>
          <span className="logo-text">ResumeScreen.AI</span>
        </div>
        <div className="nav-badges">
          <span className="badge-pill">v2.1 Enterprise</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="landing-main">
        {/* Left Hand: Hero details and animations */}
        <section className="landing-hero-section">
          <div className="hero-text-container">
            <h1 className="hero-heading animate-fade-in">
              AI-Powered Resume Screening & Assessment Platform
            </h1>
            <p className="hero-subheading animate-fade-in delay-1">
              Shortlist high-quality applicants instantly. Parse resumes, analyze job requirements, match skills, and deploy dynamic coding assessments, all in one premium ATS dashboard.
            </p>
          </div>

          {/* Floating AI Illustration */}
          <div className="hero-illustration-container animate-fade-in delay-2">
            <div className="avatar-mesh">
              <div className="orbit-item core-scanner">💻</div>
              <div className="orbit-item node-ai">🤖</div>
              <div className="orbit-item node-db">📊</div>
              <div className="orbit-item node-doc">📄</div>
              <div className="glow-sphere"></div>
            </div>
          </div>
        </section>

        {/* Right Hand: Auth Glass Card */}
        <section className="landing-auth-section">
          <div className="auth-glass-card">
            <div className="auth-header">
              <h2>{isSignUp ? 'Create Recruiter Account' : 'Welcome Back'}</h2>
              <p>
                {isSignUp
                  ? 'Sign up to build ATS resumes and screen applicants.'
                  : 'Log in to access candidate profiles and assessment rooms.'}
              </p>
            </div>

            {isDemoMode && (
              <div className="auth-demo-badge">
                <span className="pulse-dot"></span>
                <span>Demo Sandbox Mode Active</span>
              </div>
            )}

            {error && <div className="auth-error-banner">{error}</div>}
            {successMsg && <div className="auth-success-banner">{successMsg}</div>}

            <form onSubmit={handleAuth} className="auth-form">
              <div className="input-group">
                <label htmlFor="auth-email">Email Address</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="recruiter@company.com"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {isSignUp && (
                <div className="input-group">
                  <label htmlFor="auth-confirm-password">Confirm Password</label>
                  <input
                    id="auth-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}

              <div className="auth-options-row">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember Me</span>
                </label>
                <a href="#forgot" className="forgot-pwd-link" onClick={() => alert("Demo Mode: Contact admin or register a new account.")}>
                  Forgot Password?
                </a>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="spinner"></span>
                ) : isSignUp ? (
                  'Create Account'
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="auth-divider">
              <span>or continue with</span>
            </div>

            <button type="button" className="auth-google-btn" onClick={handleGoogleAuth} disabled={loading}>
              <span className="google-icon">G</span> Sign in with Google
            </button>

            <p className="auth-toggle-tip">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError('')
                  setSuccessMsg('')
                }}
              >
                {isSignUp ? 'Sign In here' : 'Register now'}
              </button>
            </p>
          </div>
        </section>
      </main>

      {/* Landing Footer */}
      <footer className="landing-footer">
        <div className="footer-credits">
          <span>&copy; 2026 ResumeScreen.AI. All rights reserved.</span>
          <span className="footer-links">
            <a href="#terms">Terms of Service</a> &bull; <a href="#privacy">Privacy Policy</a> &bull; <a href="#help">Help Desk</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
