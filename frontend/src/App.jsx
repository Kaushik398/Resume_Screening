import { useEffect, useState } from 'react'
import { API_BASE, apiFetch, checkBackendHealth } from './api'
import { supabase, isDemoMode } from './supabase'
import Auth from './components/Auth'

async function parseJsonResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data.detail
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || String(d)).join(', ')
          : 'Request failed'
    throw new Error(msg)
  }
  return data
}

const emptyResume = {
  full_name: '',
  email: '',
  phone: '',
  summary: '',
  skills: '',
  experience: '',
  education: '',
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [resumeForm, setResumeForm] = useState(emptyResume)
  const [resumeText, setResumeText] = useState('')
  const [jdText, setJdText] = useState('')
  const [resumeFile, setResumeFile] = useState(null)
  const [jdFile, setJdFile] = useState(null)
  const [showCreateResume, setShowCreateResume] = useState(false)
  const [resumeReady, setResumeReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [screenResult, setScreenResult] = useState(null)
  const [testAnswers, setTestAnswers] = useState({})
  const [testFeedback, setTestFeedback] = useState(null)
  const [step, setStep] = useState('input')
  const [backendOnline, setBackendOnline] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    checkBackendHealth().then(setBackendOnline)
    const id = setInterval(() => checkBackendHealth().then(setBackendOnline), 10000)
    return () => clearInterval(id)
  }, [])

  const updateResume = (field, value) => {
    setResumeForm((prev) => ({ ...prev, [field]: value }))
  }

  const hasResumeInput = () =>
    Boolean(resumeFile || resumeText.trim() || resumeReady)

  const getResumeTextForScreening = () => {
    if (resumeText.trim()) return resumeText.trim()
    if (resumeReady) return buildResumePreview(resumeForm)
    return ''
  }

  const applyCreatedResume = async () => {
    const preview = buildResumePreview(resumeForm)
    if (!preview.trim()) {
      setError('Fill in at least one resume field before applying.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/resume/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resumeForm),
      })
      const data = await parseJsonResponse(res)
      setResumeText(data.resume_text)
      setResumeFile(null)
      setResumeReady(true)
      setShowCreateResume(false)
    } catch (e) {
      setResumeText(preview)
      setResumeFile(null)
      setResumeReady(true)
      setShowCreateResume(false)
    } finally {
      setLoading(false)
    }
  }

  const clearResume = () => {
    setResumeText('')
    setResumeFile(null)
    setResumeReady(false)
    setResumeForm(emptyResume)
  }

  const runScreening = async () => {
    setError('')
    setScreenResult(null)
    setTestFeedback(null)
    setTestAnswers({})
    setLoading(true)

    try {
      const text = getResumeTextForScreening()

      if (!resumeFile && !text) {
        throw new Error('Add your resume by uploading a file or pasting text. Creating a resume is optional.')
      }
      if (!jdText.trim() && !jdFile) {
        throw new Error('Please provide a job description.')
      }

      let data

      if (resumeFile || jdFile) {
        const form = new FormData()
        if (resumeFile) form.append('resume_file', resumeFile)
        if (jdFile) form.append('jd_file', jdFile)
        if (text) form.append('resume_text', text)
        if (jdText.trim()) form.append('jd_text', jdText)

        const res = await apiFetch('/screen/upload', { method: 'POST', body: form })
        data = await parseJsonResponse(res)
      } else {
        const res = await apiFetch('/screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume_text: text, jd_text: jdText }),
        })
        data = await parseJsonResponse(res)
      }

      setScreenResult(data)
      setStep(data.passed ? 'test' : 'result')
    } catch (e) {
      setError(typeof e.message === 'string' ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const submitTest = async () => {
    if (!screenResult?.test) return
    const { session_id, questions } = screenResult.test

    const unanswered = questions.filter((q) => testAnswers[q.id] === undefined)
    if (unanswered.length > 0) {
      setError(`Please answer all ${questions.length} questions.`)
      return
    }

    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id, answers: testAnswers }),
      })
      const data = await parseJsonResponse(res)
      setTestFeedback(data)
      setStep('feedback')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const resetAll = () => {
    setScreenResult(null)
    setTestFeedback(null)
    setTestAnswers({})
    setError('')
    setStep('input')
  }

  const resumeStatusLabel = () => {
    if (resumeFile) return `File: ${resumeFile.name}`
    if (resumeText.trim()) return 'Resume text ready'
    if (resumeReady) return 'Created resume ready'
    return null
  }

  if (authChecking) {
    return <div className="loading">Checking authentication...</div>
  }

  if (!session) {
    return <Auth onAuthSuccess={(s) => setSession(s)} />
  }

  return (
    <div className="app">
      <div className="app-header-container">
        <header>
          <h1>Resume Screening</h1>
          <p>Upload or paste your resume, add a job description, and run match screening.</p>
        </header>
        <div className="header-user-profile">
          <div className="user-avatar">
            {session.user.email ? session.user.email[0].toUpperCase() : 'U'}
          </div>
          <span className="user-email" title={session.user.email}>
            {session.user.email}
          </span>
          {isDemoMode && <span className="demo-auth-pill">Demo</span>}
          <button
            type="button"
            className="btn-logout"
            onClick={async () => {
              await supabase.auth.signOut()
              resetAll()
            }}
          >
            Log Out
          </button>
        </div>
      </div>

      {backendOnline === false && (
        <div className="error backend-offline">
          <strong>Backend not running.</strong> Open a terminal and run:
          <code className="cmd-hint">
            cd backend; .\venv\Scripts\activate; uvicorn main:app --reload --port 8000
          </code>
          <span className="api-hint">API: {API_BASE}</span>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {step === 'input' && (
        <div className="workflow-container">
          <section className="workflow-section">
            <div className="section-header">
              <span className="step-badge">1</span>
              <div>
                <h2>Your Resume</h2>
                <p className="card-hint">Choose one option below. Creating a resume is optional.</p>
              </div>
            </div>

            {resumeStatusLabel() && (
              <div className="resume-status">
                <span>{resumeStatusLabel()}</span>
                <button type="button" className="btn-link" onClick={clearResume}>
                  Clear
                </button>
              </div>
            )}

            <div className="options-grid">
              <div className={`option-container ${resumeFile ? 'active' : ''}`}>
                <div className="option-container-header">
                  <span className="option-icon" aria-hidden>📄</span>
                  <div>
                    <h3>Upload file</h3>
                    <p>PDF, DOCX, or TXT</p>
                  </div>
                </div>
                <div className="option-container-body">
                  <label className="file-drop">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      onChange={(e) => {
                        setResumeFile(e.target.files?.[0] || null)
                        if (e.target.files?.[0]) setResumeReady(false)
                      }}
                    />
                    <span className="file-drop-label">
                      {resumeFile ? resumeFile.name : 'Click to browse or drop a file'}
                    </span>
                  </label>
                </div>
              </div>

              <div className={`option-container ${resumeText.trim() ? 'active' : ''}`}>
                <div className="option-container-header">
                  <span className="option-icon" aria-hidden>📋</span>
                  <div>
                    <h3>Paste text</h3>
                    <p>Copy your resume content</p>
                  </div>
                </div>
                <div className="option-container-body">
                  <textarea
                    value={resumeText}
                    onChange={(e) => {
                      setResumeText(e.target.value)
                      if (e.target.value.trim()) setResumeReady(false)
                    }}
                    placeholder="Paste your existing resume here..."
                    rows={6}
                  />
                </div>
              </div>

              <div className={`option-container optional ${showCreateResume || resumeReady ? 'active expanded' : ''}`}>
                <div className="option-container-header">
                  <span className="option-icon" aria-hidden>✏️</span>
                  <div>
                    <h3>
                      Create resume
                      <span className="optional-badge">Optional</span>
                    </h3>
                    <p>Only if you do not have one yet</p>
                  </div>
                  <button
                    type="button"
                    className="btn-expand"
                    onClick={() => setShowCreateResume((v) => !v)}
                    aria-expanded={showCreateResume}
                  >
                    {showCreateResume ? '−' : '+'}
                  </button>
                </div>
                {showCreateResume && (
                  <div className="option-container-body">
                    <div className="form-grid">
                      <label>
                        Full Name
                        <input
                          value={resumeForm.full_name}
                          onChange={(e) => updateResume('full_name', e.target.value)}
                          placeholder="Jane Doe"
                        />
                      </label>
                      <label>
                        Email
                        <input
                          type="email"
                          value={resumeForm.email}
                          onChange={(e) => updateResume('email', e.target.value)}
                          placeholder="jane@email.com"
                        />
                      </label>
                      <label>
                        Phone
                        <input
                          value={resumeForm.phone}
                          onChange={(e) => updateResume('phone', e.target.value)}
                          placeholder="+1 555 0100"
                        />
                      </label>
                      <label className="full-width">
                        Professional Summary
                        <textarea
                          value={resumeForm.summary}
                          onChange={(e) => updateResume('summary', e.target.value)}
                          placeholder="Brief overview..."
                        />
                      </label>
                      <label className="full-width">
                        Skills
                        <textarea
                          value={resumeForm.skills}
                          onChange={(e) => updateResume('skills', e.target.value)}
                          placeholder="Python, React, SQL..."
                        />
                      </label>
                      <label className="full-width">
                        Experience
                        <textarea
                          value={resumeForm.experience}
                          onChange={(e) => updateResume('experience', e.target.value)}
                          placeholder="Roles, companies, achievements..."
                        />
                      </label>
                      <label className="full-width">
                        Education
                        <textarea
                          value={resumeForm.education}
                          onChange={(e) => updateResume('education', e.target.value)}
                          placeholder="Degree, school, year..."
                        />
                      </label>
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={loading}
                        onClick={applyCreatedResume}
                      >
                        Use this resume for screening
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="workflow-section">
            <div className="section-header">
              <span className="step-badge">2</span>
              <div>
                <h2>Job Description</h2>
                <p className="card-hint">Upload a file or paste the job posting text.</p>
              </div>
            </div>

            <div className="options-grid options-grid-2">
              <div className={`option-container ${jdFile ? 'active' : ''}`}>
                <div className="option-container-header">
                  <span className="option-icon" aria-hidden>📎</span>
                  <div>
                    <h3>Upload JD</h3>
                    <p>PDF, DOCX, or TXT</p>
                  </div>
                </div>
                <div className="option-container-body">
                  <label className="file-drop">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      onChange={(e) => setJdFile(e.target.files?.[0] || null)}
                    />
                    <span className="file-drop-label">
                      {jdFile ? jdFile.name : 'Click to browse or drop a file'}
                    </span>
                  </label>
                </div>
              </div>

              <div className={`option-container ${jdText.trim() ? 'active' : ''}`}>
                <div className="option-container-header">
                  <span className="option-icon" aria-hidden>📝</span>
                  <div>
                    <h3>Paste JD text</h3>
                    <p>Full job description</p>
                  </div>
                </div>
                <div className="option-container-body">
                  <textarea
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste the full job description..."
                    rows={8}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="workflow-section action-section">
            <div className="action-container">
              <div>
                <h2>Run screening</h2>
                <p className="card-hint">Match score must reach 75% to unlock the assessment.</p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={loading || !hasResumeInput()}
                onClick={runScreening}
              >
                {loading ? 'Analyzing...' : 'Run Screening'}
              </button>
            </div>
            {!hasResumeInput() && (
              <p className="field-hint">Complete step 1 — add a resume file, text, or use the optional builder.</p>
            )}
          </section>
        </div>
      )}

      {loading && step !== 'input' && <div className="loading">Processing...</div>}

      {screenResult && (step === 'result' || step === 'test' || step === 'feedback') && (
        <>
          <div className={`result-banner ${screenResult.passed ? 'pass' : 'fail'}`}>
            <div className="score-ring">
              {screenResult.match_score}
              <span>% match</span>
            </div>
            <p style={{ marginTop: '0.5rem' }}>{screenResult.message}</p>
            <div className="metrics">
              <div className="metric">
                <strong>{screenResult.keyword_match_percent}%</strong>
                Keyword overlap
              </div>
              <div className="metric">
                <strong>{screenResult.skill_match_percent}%</strong>
                Skills overlap
              </div>
              <div className="metric">
                <strong>{screenResult.threshold}%</strong>
                Required threshold
              </div>
            </div>
            {screenResult.matched_skills?.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <small style={{ color: 'var(--text-muted)' }}>Matched skills</small>
                <div className="tags">
                  {screenResult.matched_skills.map((s) => (
                    <span key={s} className="tag">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {screenResult.missing_skills?.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <small style={{ color: 'var(--text-muted)' }}>Missing on resume</small>
                <div className="tags">
                  {screenResult.missing_skills.map((s) => (
                    <span key={s} className="tag missing">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!screenResult.passed && screenResult.focus_phases && (
            <div className="card">
              <h2>Focus Areas — Improve Before Reapplying</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Your match is below 75%. Work through these phases to strengthen your profile for this role.
              </p>
              {screenResult.focus_phases.map((phase, i) => (
                <div key={i} className={`phase-card ${phase.priority}`}>
                  <div className="priority">{phase.priority} priority</div>
                  <h3>{phase.phase}</h3>
                  <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{phase.description}</p>
                  <ul>
                    {phase.actions.map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="actions">
                <button type="button" className="btn btn-secondary" onClick={resetAll}>
                  Start Over
                </button>
              </div>
            </div>
          )}

          {step === 'test' && screenResult.test && (
            <div className="card">
              <h2>Role Assessment — Up to 5 Questions</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Based on the job description. Complete this to receive performance feedback.
              </p>
              {screenResult.test.questions.map((q, idx) => (
                <div key={q.id} className="question-block">
                  <p>{idx + 1}. {q.question}</p>
                  <div className="options">
                    {q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className={`option ${testAnswers[q.id] === oi ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={testAnswers[q.id] === oi}
                          onChange={() =>
                            setTestAnswers((prev) => ({ ...prev, [q.id]: oi }))
                          }
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading}
                  onClick={submitTest}
                >
                  Submit Test & Get Feedback
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetAll}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'feedback' && testFeedback && (
            <div className="card">
              <h2>Test Feedback</h2>
              <span className={`feedback-level ${testFeedback.feedback.level}`}>
                {testFeedback.feedback.level.replace('_', ' ')}
              </span>
              <div className="score-ring" style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
                {testFeedback.score_percent}
                <span>% on test</span>
              </div>
              <p>{testFeedback.feedback.message}</p>
              <p style={{ marginTop: '0.75rem' }}>{testFeedback.feedback.summary}</p>
              <h3 style={{ marginTop: '1.25rem', fontSize: '0.95rem' }}>Recommendations</h3>
              <ul style={{ marginLeft: '1.25rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                {testFeedback.feedback.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <h3 style={{ marginTop: '1.25rem', fontSize: '0.95rem' }}>Answer Breakdown</h3>
              {testFeedback.breakdown.map((b) => (
                <div
                  key={b.id}
                  className={`breakdown-item ${b.is_correct ? 'correct' : 'incorrect'}`}
                >
                  <strong>{b.is_correct ? 'Correct' : 'Incorrect'}</strong>
                  <p style={{ marginTop: '0.25rem' }}>{b.question}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Your answer: {b.your_answer} · Correct: {b.correct_answer}
                  </p>
                </div>
              ))}
              <div className="actions">
                <button type="button" className="btn btn-primary" onClick={resetAll}>
                  Screen Another Role
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function buildResumePreview(form) {
  const parts = []
  if (form.full_name) parts.push(form.full_name.toUpperCase())
  if (form.email) parts.push(`Email: ${form.email}`)
  if (form.phone) parts.push(`Phone: ${form.phone}`)
  if (form.summary) parts.push(`\nSUMMARY\n${form.summary}`)
  if (form.skills) parts.push(`\nSKILLS\n${form.skills}`)
  if (form.experience) parts.push(`\nEXPERIENCE\n${form.experience}`)
  if (form.education) parts.push(`\nEDUCATION\n${form.education}`)
  return parts.join('\n')
}
