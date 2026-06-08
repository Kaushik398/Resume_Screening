import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Check if credentials are set and are not placeholder values
const isConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon-public-key')

class DemoAuthClient {
  constructor() {
    this.listeners = new Set()
    // Restore or initialize demo users database
    if (!localStorage.getItem('demo_users')) {
      localStorage.setItem('demo_users', JSON.stringify({}))
    }
  }

  _getUsers() {
    return JSON.parse(localStorage.getItem('demo_users') || '{}')
  }

  _saveUsers(users) {
    localStorage.setItem('demo_users', JSON.stringify(users))
  }

  _getSession() {
    const sessionStr = localStorage.getItem('demo_session')
    return sessionStr ? JSON.parse(sessionStr) : null
  }

  _saveSession(session) {
    if (session) {
      localStorage.setItem('demo_session', JSON.stringify(session))
    } else {
      localStorage.removeItem('demo_session')
    }
    this._notify(session)
  }

  _notify(session) {
    const event = session ? 'SIGNED_IN' : 'SIGNED_OUT'
    this.listeners.forEach((cb) => {
      try {
        cb(event, session)
      } catch (e) {
        console.error('Error in auth listener:', e)
      }
    })
  }

  async signUp({ email, password }) {
    await new Promise((r) => setTimeout(r, 800)) // simulate network delay
    const users = this._getUsers()
    
    if (users[email]) {
      return { data: { user: null }, error: { message: 'User already exists.' } }
    }

    users[email] = password
    this._saveUsers(users)

    const user = { id: `demo-usr-${Math.random().toString(36).substr(2, 9)}`, email }
    const session = {
      access_token: `demo-token-${btoa(JSON.stringify(user))}`,
      user,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }

    this._saveSession(session)
    return { data: { user, session }, error: null }
  }

  async signInWithPassword({ email, password }) {
    await new Promise((r) => setTimeout(r, 800)) // simulate network delay
    const users = this._getUsers()

    if (!users[email] || users[email] !== password) {
      return { data: { user: null }, error: { message: 'Invalid login credentials.' } }
    }

    const user = { id: `demo-usr-${btoa(email)}`, email }
    const session = {
      access_token: `demo-token-${btoa(JSON.stringify(user))}`,
      user,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }

    this._saveSession(session)
    return { data: { user, session }, error: null }
  }

  async signOut() {
    await new Promise((r) => setTimeout(r, 300))
    this._saveSession(null)
    return { error: null }
  }

  async getSession() {
    return { data: { session: this._getSession() }, error: null }
  }

  onAuthStateChange(callback) {
    this.listeners.add(callback)
    // Trigger immediately with current state
    const session = this._getSession()
    callback(session ? 'INITIAL_SESSION' : 'SIGNED_OUT', session)

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners.delete(callback)
          },
        },
      },
    }
  }
}

// Export either standard Supabase client or Demo client
export const isDemoMode = !isConfigured

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      auth: new DemoAuthClient(),
    }
