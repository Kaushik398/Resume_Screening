import { useEffect, useState, useRef } from 'react'
import { API_BASE, apiFetch, checkBackendHealth } from './api'
import { supabase, isDemoMode } from './supabase'
import Auth from './components/Auth'
import ConversationalForm from './components/ConversationalForm'
import AdminDashboard from './components/AdminDashboard'
import RadarChart from './components/RadarChart'

export default function App() {
  const [session, setSession] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [backendOnline, setBackendOnline] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Navigation tab: 'resume-hub', 'screening', 'feedback', 'admin'
  const [activeTab, setActiveTab] = useState('resume-hub')

  // Resume states
  const [resumeTab, setResumeTab] = useState('upload') // 'upload', 'paste', 'chat'
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeText, setResumeText] = useState('')
  const [resumePolished, setResumePolished] = useState(null)
  const [resumePreviewLines, setResumePreviewLines] = useState([])
  const [resumeReady, setResumeReady] = useState(false)

  // Job Description states
  const [jdTab, setJdTab] = useState('upload') // 'upload', 'paste'
  const [jdFile, setJdFile] = useState(null)
  const [jdText, setJdText] = useState('')
  const [jdTitle, setJdTitle] = useState('Software Engineer')

  // Screening States
  const [screeningResult, setScreeningResult] = useState(null)

  // Assessment & Test States
  const [difficulty, setDifficulty] = useState('medium')
  const [configuredDuration, setConfiguredDuration] = useState(10) // default 10 mins
  const [testSession, setTestSession] = useState(null)
  const [testActive, setTestActive] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [testAnswers, setTestAnswers] = useState({})
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [testFeedback, setTestFeedback] = useState(null)

  const timerIntervalRef = useRef(null)

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
    const id = setInterval(() => checkBackendHealth().then(setBackendOnline), 12000)
    return () => clearInterval(id)
  }, [])

  // Countdown timer logic
  useEffect(() => {
    if (testActive && timerSeconds > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current)
            // Auto-submit when timer expires
            submitTestAssessment(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [testActive, timerSeconds])

  // Process and read file text for preview
  const handleResumeFileChange = (e) => {
    const file = e.target.files?.[0] || null
    setResumeFile(file)
    setResumePolished(null)
    setResumeReady(false)
    setError('')

    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result
        if (typeof text === 'string') {
          // Display the first 20 lines as a preview
          const lines = text.split('\n').slice(0, 20)
          setResumePreviewLines(lines)
          setResumeText(text)
          setResumeReady(true)
        }
      }
      reader.readAsText(file)
    } else {
      setResumePreviewLines([])
      setResumeText('')
    }
  }

  const handleJdFileChange = (e) => {
    const file = e.target.files?.[0] || null
    setJdFile(file)
    setError('')

    if (file) {
      setJdTitle(file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "))
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result
        if (typeof text === 'string') {
          setJdText(text)
        }
      }
      reader.readAsText(file)
    } else {
      setJdText('')
    }
  }

  const getResumeContent = () => {
    if (resumePolished) {
      return buildResumeFromPolished(resumePolished)
    }
    return resumeText
  }

  const buildResumeFromPolished = (form) => {
    const parts = []
    if (form.full_name) parts.push(form.full_name.toUpperCase())
    if (form.email) parts.push(`Email: ${form.email}`)
    if (form.phone) parts.push(`Phone: ${form.phone}`)
    if (form.linkedin) parts.push(`LinkedIn: ${form.linkedin}`)
    if (form.github) parts.push(`GitHub: ${form.github}`)
    if (form.summary) parts.push(`\nSUMMARY\n${form.summary}`)
    if (form.skills) parts.push(`\nSKILLS\n${form.skills}`)
    if (form.experience) parts.push(`\nEXPERIENCE\n${form.experience}`)
    if (form.education) parts.push(`\nEDUCATION\n${form.education}`)
    if (form.projects) parts.push(`\nPROJECTS\n${form.projects}`)
    if (form.certifications) parts.push(`\nCERTIFICATIONS\n${form.certifications}`)
    if (form.achievements) parts.push(`\nACHIEVEMENTS\n${form.achievements}`)
    return parts.join('\n')
  }

  const handleConversationalSuccess = (polishedData) => {
    setResumePolished(polishedData)
    setResumeReady(true)
    // Switch to screening input
    setActiveTab('screening')
  }

  // Formatting helper for rich JD editor
  const applyJdTemplate = (type) => {
    if (type === 'react') {
      setJdText(`JOB ROLE: Senior React Developer\n\nREQUIRED SKILLS:\n- React.js, Redux Toolkit, TypeScript, Webpack\n- HTML5, CSS3, Tailwind CSS\n- Git, GitHub, CI/CD pipelines\n\nEXPERIENCE LEVEL:\n- 4+ years of front-end engineering experience.\n\nRESPONSIBILITIES:\n- Develop responsive modular dashboards with glassmorphism styles.\n- Optimize API caching layers and decrease paint latencies.\n- Mentor junior react engineers.`)
      setJdTitle('Senior React Developer')
    } else if (type === 'python') {
      setJdText(`JOB ROLE: Backend Python Engineer\n\nREQUIRED SKILLS:\n- Python, FastAPI, Django, PostgreSQL\n- Docker, Kubernetes, AWS Cloud services\n- SQL queries and database optimizations\n\nEXPERIENCE LEVEL:\n- 3+ years of backend development.\n\nRESPONSIBILITIES:\n- Build secure, scalable RESTful API microservices.\n- Optimize database queries and setup caching layers.\n- Write clean automated tests.`)
      setJdTitle('Backend Python Engineer')
    }
  }

  const runAtsScreening = async () => {
    setError('')
    setScreeningResult(null)
    setTestSession(null)
    setLoading(true)

    try {
      const resText = getResumeContent()
      if (!resText.trim() && !resumeFile) {
        throw new Error('Please add your resume (upload, paste, or chatbot) before screening.')
      }
      if (!jdText.trim() && !jdFile) {
        throw new Error('Please upload or type the job description.')
      }

      let data
      if (resumeFile || jdFile) {
        const form = new FormData()
        if (resumeFile) form.append('resume_file', resumeFile)
        if (jdFile) form.append('jd_file', jdFile)
        if (resText.trim()) form.append('resume_text', resText)
        if (jdText.trim()) form.append('jd_text', jdText)
        
        // Add metadata
        form.append('preferred_role', jdTitle)
        if (resumePolished?.full_name) {
          form.append('full_name', resumePolished.full_name)
          form.append('email', resumePolished.email)
          form.append('phone', resumePolished.phone)
        }

        const res = await apiFetch('/screen/upload', {
          method: 'POST',
          body: form
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || 'Error uploading and screening.')
        }
        data = await res.json()
      } else {
        const res = await apiFetch('/screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume_text: resText,
            jd_text: jdText,
            full_name: resumePolished?.full_name || '',
            email: resumePolished?.email || '',
            phone: resumePolished?.phone || '',
            preferred_role: jdTitle
          })
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || 'Error matching text.')
        }
        data = await res.json()
      }

      setScreeningResult(data)
      // If screening generates a test session directly in response
      if (data.test) {
        setTestSession(data.test)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const startTestAssessment = () => {
    if (!testSession) return
    setTestActive(true)
    setCurrentQuestionIndex(0)
    setTestAnswers({})
    setTimerSeconds(configuredDuration * 60)
  }

  const handleSelectOption = (questionId, optionIndex) => {
    setTestAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex
    }))
  }

  const submitTestAssessment = async (forced = false) => {
    if (!testSession) return
    
    // Check if all answered
    const unanswered = testSession.questions.filter((q) => testAnswers[q.id] === undefined)
    if (unanswered.length > 0 && !forced) {
      const confirmSubmit = window.confirm(`You have ${unanswered.length} unanswered questions. Submit anyway?`)
      if (!confirmSubmit) return
    }

    setLoading(true)
    setError('')
    setTestActive(false)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)

    try {
      const res = await apiFetch('/test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: testSession.session_id,
          answers: testAnswers
        })
      })

      if (!res.ok) {
        throw new Error('Failed to grade test. Session may have expired.')
      }

      const data = await res.json()
      setTestFeedback(data)
      setActiveTab('feedback')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadFeedback = () => {
    if (!testFeedback) return
    const reportText = `TEST SCORE REPORT\n` +
      `Score: ${testFeedback.score_percent}%\n` +
      `Correct: ${testFeedback.correct_count} / ${testFeedback.total_questions}\n\n` +
      `AI SUMMARY:\n${testFeedback.feedback?.summary || ''}\n\n` +
      `RECOMMENDATIONS:\n` +
      (testFeedback.feedback?.recommendations || []).map((r, i) => `${i+1}. ${r}`).join('\n')
      
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", "candidate_test_feedback.txt")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const clearAllFields = () => {
    setResumeFile(null)
    setResumeText('')
    setResumePolished(null)
    setResumeReady(false)
    setResumePreviewLines([])
    setJdFile(null)
    setJdText('')
    setJdTitle('Software Engineer')
    setScreeningResult(null)
    setTestSession(null)
    setTestActive(false)
    setTestFeedback(null)
    setError('')
  }

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60)
    const remainSecs = secs % 60
    return `${mins}:${remainSecs < 10 ? '0' : ''}${remainSecs}`
  }

  if (authChecking) {
    return (
      <div className="auth-checking-container">
        <div className="spinner"></div>
        <p>Checking security session...</p>
      </div>
    )
  }

  if (!session) {
    return <Auth onAuthSuccess={(s) => setSession(s)} />
  }

  return (
    <div className="app-container">
      {/* Side Navigation Bar */}
      <aside className="app-sidebar no-print">
        <div className="sidebar-brand">
          <span className="brand-logo">💠</span>
          <div>
            <h1>RecruitAI</h1>
            <p>ATS Platform</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            type="button" 
            className={`nav-btn ${activeTab === 'resume-hub' ? 'active' : ''}`}
            onClick={() => { if(!testActive) setActiveTab('resume-hub') }}
            disabled={testActive}
          >
            <span className="nav-icon">👤</span> Resume Hub
          </button>
          <button 
            type="button" 
            className={`nav-btn ${activeTab === 'screening' ? 'active' : ''}`}
            onClick={() => { if(!testActive) setActiveTab('screening') }}
            disabled={testActive}
          >
            <span className="nav-icon">🎯</span> Screen & Assessment
          </button>
          {testFeedback && (
            <button 
              type="button" 
              className={`nav-btn ${activeTab === 'feedback' ? 'active' : ''}`}
              onClick={() => { if(!testActive) setActiveTab('feedback') }}
              disabled={testActive}
            >
              <span className="nav-icon">📈</span> Test Feedback
            </button>
          )}
          <button 
            type="button" 
            className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => { if(!testActive) setActiveTab('admin') }}
            disabled={testActive}
          >
            <span className="nav-icon">🛡️</span> Recruiter Dashboard
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-widget">
            <div className="avatar">
              {session.user.email ? session.user.email[0].toUpperCase() : 'U'}
            </div>
            <div className="details">
              <strong>Recruiter Mode</strong>
              <span title={session.user.email}>{session.user.email}</span>
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-logout-sidebar"
            onClick={async () => {
              await supabase.auth.signOut()
              clearAllFields()
            }}
            disabled={testActive}
          >
            Log Out Session
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <div className="app-main-panel">
        
        {/* Backend health status badge */}
        <header className="panel-header no-print">
          <div className="breadcrumbs">
            <span>Dashboard</span> &raquo; <span className="active-path">{activeTab.toUpperCase().replace('-', ' ')}</span>
          </div>
          
          <div className="header-status-pills">
            {backendOnline === false ? (
              <span className="health-pill offline">Backend Offline</span>
            ) : (
              <span className="health-pill online">API Server Active</span>
            )}
            {isDemoMode && <span className="demo-pill">Sandbox Credentials</span>}
          </div>
        </header>

        <main className="panel-content">
          {error && <div className="error no-print">{error}</div>}

          {/* PAGE 2: RESUME HUB */}
          {activeTab === 'resume-hub' && (
            <div className="tab-pane">
              <div className="pane-header">
                <h2>Resume & Candidate Management</h2>
                <p>Provide a candidate resume via drag-and-drop upload or utilize our conversational chatbot helper to structure one.</p>
              </div>

              {/* Sub-tabs for resume addition */}
              <div className="tab-pills">
                <button 
                  type="button" 
                  className={`pill-btn ${resumeTab === 'upload' ? 'active' : ''}`}
                  onClick={() => setResumeTab('upload')}
                >
                  Drag & Drop Resume
                </button>
                <button 
                  type="button" 
                  className={`pill-btn ${resumeTab === 'paste' ? 'active' : ''}`}
                  onClick={() => setResumeTab('paste')}
                >
                  Copy & Paste Resume
                </button>
                <button 
                  type="button" 
                  className={`pill-btn ${resumeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setResumeTab('chat')}
                >
                  Create Resume using AI
                </button>
              </div>

              {resumeTab === 'upload' && (
                <div className="card">
                  <h3>Upload Resume / CV</h3>
                  <div className="drag-drop-zone">
                    <input 
                      type="file" 
                      accept=".pdf,.docx,.txt" 
                      onChange={handleResumeFileChange} 
                    />
                    <div className="zone-message">
                      <span className="message-icon">📄</span>
                      <p>{resumeFile ? `Selected: ${resumeFile.name}` : "Drag and drop your PDF or DOCX file, or click here to browse"}</p>
                      <small className="help-text">Accepted formats: PDF, DOCX, TXT. Max size: 8MB.</small>
                    </div>
                  </div>

                  {resumeReady && (
                    <div className="file-preview-panel">
                      <h4>File Preview Panel</h4>
                      <div className="lines-scroll-box">
                        {resumePreviewLines.map((l, i) => (
                          <div key={i} className="line">{l}</div>
                        ))}
                      </div>
                      <span className="status-indicator">✅ Resume successfully parsed and ready for screening.</span>
                    </div>
                  )}
                </div>
              )}

              {resumeTab === 'paste' && (
                <div className="card">
                  <h3>Paste Resume Text Content</h3>
                  <p className="card-hint">Paste full plain text representation of the CV here.</p>
                  <textarea
                    className="plain-text-area"
                    value={resumeText}
                    onChange={(e) => {
                      setResumeText(e.target.value)
                      setResumePolished(null)
                      setResumeReady(e.target.value.trim().length > 10)
                    }}
                    placeholder="PASTE RESUME CONTENT HERE..."
                    rows={12}
                  />
                  {resumeReady && (
                    <div style={{ marginTop: '1rem' }}>
                      <span className="status-indicator">✅ Plain text resume stored and ready.</span>
                    </div>
                  )}
                </div>
              )}

              {resumeTab === 'chat' && (
                <ConversationalForm 
                  onGenerateSuccess={handleConversationalSuccess} 
                  apiFetch={apiFetch}
                />
              )}

              {resumeReady && (
                <div className="actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={() => setActiveTab('screening')}
                  >
                    Proceed to Job Description & Screening &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PAGE 3: JOB DESCRIPTION & SCREENING */}
          {activeTab === 'screening' && (
            <div className="tab-pane">
              {!testActive ? (
                <>
                  <div className="pane-header">
                    <h2>Job Description & ATS Screening</h2>
                    <p>Provide the targeting job details, trigger the NLP semantic comparison engine, and view candidate matching diagnostics.</p>
                  </div>

                  {/* Section 1: Job Description input */}
                  <div className="card no-print">
                    <h3>Section 1: Job Description</h3>
                    <div className="tab-pills" style={{ marginTop: '0.75rem' }}>
                      <button 
                        type="button" 
                        className={`pill-btn ${jdTab === 'upload' ? 'active' : ''}`}
                        onClick={() => setJdTab('upload')}
                      >
                        Upload JD Document
                      </button>
                      <button 
                        type="button" 
                        className={`pill-btn ${jdTab === 'paste' ? 'active' : ''}`}
                        onClick={() => setJdTab('paste')}
                      >
                        Type / Paste Job Description
                      </button>
                    </div>

                    {jdTab === 'upload' && (
                      <div className="drag-drop-zone">
                        <input 
                          type="file" 
                          accept=".pdf,.docx,.txt" 
                          onChange={handleJdFileChange} 
                        />
                        <div className="zone-message">
                          <span className="message-icon">📎</span>
                          <p>{jdFile ? `Selected: ${jdFile.name}` : "Drag and drop the Job Posting PDF/DOCX, or click here to browse"}</p>
                          <small className="help-text">We automatically extract roles and target skills from files.</small>
                        </div>
                      </div>
                    )}

                    {jdTab === 'paste' && (
                      <div className="rich-editor-container">
                        <div className="editor-toolbar">
                          <button type="button" onClick={() => applyJdTemplate('react')}>Load React Template</button>
                          <button type="button" onClick={() => applyJdTemplate('python')}>Load Python Template</button>
                          <button type="button" onClick={() => setJdText('')}>Clear Text</button>
                        </div>
                        <input
                          type="text"
                          className="jd-title-input"
                          value={jdTitle}
                          onChange={(e) => setJdTitle(e.target.value)}
                          placeholder="Target Job Title (e.g. Frontend React Developer)"
                        />
                        <textarea
                          className="plain-text-area"
                          value={jdText}
                          onChange={(e) => setJdText(e.target.value)}
                          placeholder="Type or paste the job duties, qualifications, and required tech stacks..."
                          rows={8}
                        />
                      </div>
                    )}

                    <div className="actions" style={{ marginTop: '1.25rem' }}>
                      <button 
                        type="button" 
                        className="btn btn-primary"
                        onClick={runAtsScreening}
                        disabled={loading || (!resumeFile && !resumeText.trim() && !resumePolished)}
                      >
                        {loading ? 'Analyzing Matching Metrics...' : 'Analyze Job Description & Screen Resume'}
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Screening Dashboard */}
                  {screeningResult && (
                    <div className="card screening-dashboard-pane">
                      <h3>Section 2: Resume Screening Report</h3>
                      
                      <div className="report-layout-split">
                        
                        {/* Circular Match indicator */}
                        <div className="ats-score-card">
                          <div className="progress-circle-wrap">
                            {/* Radial SVG Circle representation */}
                            <svg className="radial-svg" width="120" height="120">
                              <circle cx="60" cy="60" r="50" className="bg-circle" />
                              <circle 
                                cx="60" 
                                cy="60" 
                                r="50" 
                                className="fill-circle" 
                                strokeDasharray={314}
                                strokeDashoffset={314 - (314 * screeningResult.match_score) / 100}
                                stroke={screeningResult.match_score >= 75 ? 'var(--success)' : screeningResult.match_score >= 50 ? 'var(--warning)' : 'var(--danger)'}
                              />
                            </svg>
                            <span className="score-percentage-text">{screeningResult.match_score}%</span>
                          </div>
                          <h4>ATS Match Score</h4>
                          <span className={`decision-pill ${screeningResult.decision.toLowerCase().replace(' ', '_')}`}>
                            {screeningResult.decision}
                          </span>
                        </div>

                        {/* Breakdown diagnostics */}
                        <div className="screening-diagnostics">
                          <div className="score-bars">
                            <div className="bar-row">
                              <span>Skills Match</span>
                              <div className="progress-bar-track">
                                <div className="progress-bar-fill" style={{ width: `${screeningResult.skill_match_percent}%` }}></div>
                              </div>
                              <span className="pct">{screeningResult.skill_match_percent}%</span>
                            </div>
                            <div className="bar-row">
                              <span>Keyword Match</span>
                              <div className="progress-bar-track">
                                <div className="progress-bar-fill" style={{ width: `${screeningResult.keyword_match_percent}%` }}></div>
                              </div>
                              <span className="pct">{screeningResult.keyword_match_percent}%</span>
                            </div>
                          </div>

                          <div className="skills-analysis-badges" style={{ marginTop: '1rem' }}>
                            {screeningResult.matched_skills?.length > 0 && (
                              <div className="badge-group">
                                <strong>Matched Tech Stacks:</strong>
                                <div className="tags">
                                  {screeningResult.matched_skills.map((s, idx) => (
                                    <span key={idx} className="tag">{s}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {screeningResult.missing_skills?.length > 0 && (
                              <div className="badge-group" style={{ marginTop: '0.75rem' }}>
                                <strong style={{ color: '#fcd34d' }}>Missing Core Keywords:</strong>
                                <div className="tags">
                                  {screeningResult.missing_skills.map((s, idx) => (
                                    <span key={idx} className="tag missing">{s}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Strengths & Focus areas */}
                      <div className="feedback-details-section" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                        <h4>Screening Feedback & Focus Areas</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{screeningResult.message}</p>
                        
                        {screeningResult.focus_phases?.length > 0 && (
                          <div className="focus-phases-container" style={{ marginTop: '1rem' }}>
                            {screeningResult.focus_phases.map((phase, pIdx) => (
                              <div key={pIdx} className={`phase-item ${phase.priority}`}>
                                <h5>{phase.phase} <span className="priority-tag">{phase.priority} priority</span></h5>
                                <p>{phase.description}</p>
                                <ul>
                                  {phase.actions.map((act, aIdx) => (
                                    <li key={aIdx}>{act}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Section 3: Assessment generating logic */}
                      {screeningResult.passed && testSession && (
                        <div className="assessment-unlocked-card" style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                          <div className="unlocked-header">
                            <span className="unlock-icon">🎉</span>
                            <div>
                              <h4>Congratulations! You are eligible for an AI-generated assessment.</h4>
                              <p>The system has generated a custom interview challenge testing matching skills.</p>
                            </div>
                          </div>

                          <div className="test-config-row">
                            <label>
                              Test Difficulty
                              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                                <option value="easy">Easy (Syntax & Core Principles)</option>
                                <option value="medium">Medium (Debugging & Design Patterns)</option>
                                <option value="hard">Hard (Scaling & Deep System Architecture)</option>
                              </select>
                            </label>

                            <label>
                              Countdown Limit (Minutes)
                              <select value={configuredDuration} onChange={(e) => setConfiguredDuration(Number(e.target.value))}>
                                <option value={3}>3 Minutes (Short check)</option>
                                <option value={5}>5 Minutes</option>
                                <option value={10}>10 Minutes</option>
                                <option value={15}>15 Minutes</option>
                                <option value={20}>20 Minutes</option>
                              </select>
                            </label>
                          </div>

                          <div className="actions" style={{ marginTop: '1.25rem' }}>
                            <button 
                              type="button" 
                              className="btn btn-primary btn-lg"
                              onClick={startTestAssessment}
                            >
                              🚀 Start Role Assessment Now
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* ACTIVE TEST RUNNING INTERFACE (PAGE 4) */
                <div className="card test-runner-interface">
                  <header className="test-header">
                    <div className="left">
                      <h3>{jdTitle} Challenge</h3>
                      <span className="difficulty-tag">{difficulty.toUpperCase()}</span>
                    </div>

                    <div className="timer-countdown-box">
                      <span className="clock-icon">⏳</span>
                      <span className={`timer-num ${timerSeconds < 60 ? 'critical' : ''}`}>
                        {formatTime(timerSeconds)}
                      </span>
                    </div>
                  </header>

                  <div className="test-progress-bar">
                    <div 
                      className="fill" 
                      style={{ width: `${((currentQuestionIndex + 1) / testSession.questions.length) * 100}%` }}
                    ></div>
                    <span className="fraction">Question {currentQuestionIndex + 1} of {testSession.questions.length}</span>
                  </div>

                  <div className="question-display-card">
                    <span className="q-type-label">{testSession.questions[currentQuestionIndex].type || 'Technical MCQ'}</span>
                    <p className="q-text">{testSession.questions[currentQuestionIndex].question}</p>

                    <div className="options-list">
                      {testSession.questions[currentQuestionIndex].options.map((opt, oIdx) => {
                        const isSelected = testAnswers[testSession.questions[currentQuestionIndex].id] === oIdx
                        return (
                          <label 
                            key={oIdx} 
                            className={`test-option-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelectOption(testSession.questions[currentQuestionIndex].id, oIdx)}
                          >
                            <input 
                              type="radio" 
                              name={testSession.questions[currentQuestionIndex].id} 
                              checked={isSelected}
                              onChange={() => {}}
                            />
                            <span className="opt-letter">{String.fromCharCode(65 + oIdx)}.</span>
                            <span className="opt-text">{opt}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className="actions" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '1.5rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentQuestionIndex === 0}
                    >
                      &larr; Previous Question
                    </button>

                    {currentQuestionIndex < testSession.questions.length - 1 ? (
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                      >
                        Next Question &rarr;
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        className="btn btn-primary"
                        onClick={() => submitTestAssessment()}
                        disabled={loading}
                      >
                        {loading ? 'Submitting Responses...' : 'Submit Assessment Answers'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PAGE 5: FEEDBACK & REPORT */}
          {activeTab === 'feedback' && testFeedback && (
            <div className="tab-pane printable-report-sheet">
              <div className="pane-header no-print">
                <h2>Candidate Assessment Feedback</h2>
                <p>Detailed performance report mapping sub-dimensional evaluations and custom recommendations.</p>
              </div>

              <div className="card report-card">
                <div className="report-header">
                  <div>
                    <h2>AI-Assessment Results Report</h2>
                    <p className="job">{jdTitle}</p>
                    <p className="date">Date Screened: {new Date().toLocaleDateString()}</p>
                  </div>
                  
                  <div className="final-rating-block">
                    <span className={`rec-tag ${testFeedback.feedback?.recommendation_status?.toLowerCase().replace(' ', '_')}`}>
                      {testFeedback.feedback?.recommendation_status || 'Recommended'}
                    </span>
                    <div className="score-score-ring">
                      {testFeedback.score_percent}%
                      <span>Test Score</span>
                    </div>
                  </div>
                </div>

                <div className="report-grid-split">
                  
                  {/* Radar Chart & Subscores */}
                  <div className="radar-col">
                    <RadarChart scores={testFeedback.feedback?.radar_scores} />
                    
                    {testFeedback.feedback?.radar_scores && (
                      <div className="subscores-legend">
                        <div className="subscore-legend-item">
                          <span>Technical Skills:</span>
                          <strong>{testFeedback.feedback.radar_scores.technical_skills}%</strong>
                        </div>
                        <div className="subscore-legend-item">
                          <span>Problem Solving:</span>
                          <strong>{testFeedback.feedback.radar_scores.problem_solving}%</strong>
                        </div>
                        <div className="subscore-legend-item">
                          <span>Communication:</span>
                          <strong>{testFeedback.feedback.radar_scores.communication}%</strong>
                        </div>
                        <div className="subscore-legend-item">
                          <span>Domain Knowledge:</span>
                          <strong>{testFeedback.feedback.radar_scores.domain_knowledge}%</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Written report & course recommendations */}
                  <div className="details-col">
                    <div className="summary-block">
                      <h4>AI Feedback & Overview</h4>
                      <p>{testFeedback.feedback?.message}</p>
                      <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>{testFeedback.feedback?.summary}</p>
                    </div>

                    <div className="rec-block" style={{ marginTop: '1.25rem' }}>
                      <h4>Key Recruiter Recommendations</h4>
                      <ul>
                        {testFeedback.feedback?.recommendations?.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>

                    {testFeedback.feedback?.courses?.length > 0 && (
                      <div className="courses-block" style={{ marginTop: '1.25rem' }}>
                        <h4>Suggested Learning Areas</h4>
                        <div className="courses-tags">
                          {testFeedback.feedback.courses.map((course, idx) => (
                            <span key={idx} className="course-tag-pill">📚 {course}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Answers breakdown review */}
                <div className="report-breakdown-section" style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                  <h4>Assessment Answers Review</h4>
                  <div className="questions-breakdown-list">
                    {testFeedback.breakdown?.map((item, idx) => (
                      <div key={idx} className={`q-breakdown-card ${item.is_correct ? 'correct' : 'incorrect'}`}>
                        <div className="q-head">
                          <span className="q-num">Question {idx + 1}</span>
                          <span className={`status-icon-badge ${item.is_correct ? 'pass' : 'fail'}`}>
                            {item.is_correct ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>
                        <p className="q-body-text">{item.question}</p>
                        <div className="q-selection-review">
                          <span>Selected Answer: <strong style={{ color: item.is_correct ? 'var(--success)' : 'var(--danger)' }}>{item.your_answer}</strong></span>
                          {!item.is_correct && <span>Correct Answer: <strong style={{ color: 'var(--success)' }}>{item.correct_answer}</strong></span>}
                        </div>
                        {item.explanation && (
                          <p className="q-explanation-text">
                            <strong>Explanation:</strong> {item.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons for reports */}
              <div className="actions no-print" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                  🖨️ Download/Print Report PDF
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleDownloadFeedback}>
                  📥 Download Candidate Feedback TXT
                </button>
                <button type="button" className="btn btn-primary" onClick={clearAllFields}>
                  Start New Applicant Screening
                </button>
              </div>
            </div>
          )}

          {/* PAGE 6: RECRUITER PORTAL */}
          {activeTab === 'admin' && (
            <AdminDashboard apiFetch={apiFetch} />
          )}

        </main>
      </div>
    </div>
  )
}
