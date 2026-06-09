import { useState, useEffect, useRef } from 'react'

const CHAT_STEPS = [
  { key: 'full_name', prompt: "Hello! I am your AI Career Assistant. Let's build a professional, ATS-optimized resume. To start, what is your full name?", placeholder: "e.g., John Doe" },
  { key: 'email', prompt: "Great! What is your email address? We will use this to link your profile.", placeholder: "e.g., john.doe@email.com" },
  { key: 'phone', prompt: "What is your phone number?", placeholder: "e.g., +1 (555) 0100" },
  { key: 'linkedin', prompt: "Optional: Paste your LinkedIn profile URL (or type 'skip').", placeholder: "e.g., linkedin.com/in/johndoe", optional: true },
  { key: 'github', prompt: "Optional: Paste your GitHub profile URL (or type 'skip').", placeholder: "e.g., github.com/johndoe", optional: true },
  { key: 'preferred_role', prompt: "What is your target/preferred job role?", placeholder: "e.g., Senior React Developer, Full Stack Engineer" },
  { key: 'summary', prompt: "Let's capture your professional background. Provide a brief summary of your core strengths and career goals.", placeholder: "e.g., Passionate developer with 3+ years experience..." },
  { key: 'skills', prompt: "List your key technical skills (separated by commas).", placeholder: "e.g., React, Node.js, Python, PostgreSQL, AWS" },
  { key: 'experience', prompt: "Detail your work experience. Describe your previous roles, companies, and achievements. Don't worry about perfect wording; I will rewrite them to sound professional!", placeholder: "e.g., I worked at ABC Corp as a front-end developer for 2 years. I built their dashboard." },
  { key: 'education', prompt: "What is your educational background?", placeholder: "e.g., B.S. in Computer Science, State University, 2022" },
  { key: 'projects', prompt: "Optional: Mention any notable projects you've worked on (or type 'skip').", placeholder: "e.g., E-commerce App - built with React and Stripe API", optional: true },
  { key: 'certifications', prompt: "Optional: Add any relevant certifications (or type 'skip').", placeholder: "e.g., AWS Certified Cloud Practitioner", optional: true },
  { key: 'achievements', prompt: "Optional: List any professional achievements or awards (or type 'skip').", placeholder: "e.g., Winner of Tech Hackathon 2025", optional: true }
]

export default function ConversationalForm({ onGenerateSuccess, apiFetch }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [formData, setFormData] = useState({})
  const [messages, setMessages] = useState([])
  const [inputVal, setInputVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // States for final preview and manual editing
  const [resumePolished, setResumePolished] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  
  const messagesEndRef = useRef(null)

  useEffect(() => {
    // Prime the first bot prompt on mount
    setMessages([
      { sender: 'bot', text: CHAT_STEPS[0].prompt }
    ])
  }, [])

  useEffect(() => {
    // Auto scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e?.preventDefault()
    if (!inputVal.trim() && !CHAT_STEPS[stepIndex].optional) return

    const userText = inputVal.trim() || 'skipped'
    const currentStep = CHAT_STEPS[stepIndex]

    // Save field value
    const updatedFormData = {
      ...formData,
      [currentStep.key]: userText.toLowerCase() === 'skip' || userText === 'skipped' ? '' : userText
    }
    setFormData(updatedFormData)

    // Add user response to messages
    const nextMessages = [...messages, { sender: 'user', text: userText }]
    setMessages(nextMessages)
    setInputVal('')

    const nextIndex = stepIndex + 1
    if (nextIndex < CHAT_STEPS.length) {
      setStepIndex(nextIndex)
      setMessages([...nextMessages, { sender: 'bot', text: CHAT_STEPS[nextIndex].prompt }])
    } else {
      // Completed all steps - trigger AI generation
      setStepIndex(nextIndex)
      setMessages([...nextMessages, { sender: 'bot', text: "Perfect! I have collected all the details. I am now optimizing your resume with ATS action verbs..." }])
      await triggerAiGeneration(updatedFormData)
    }
  }

  const triggerAiGeneration = async (data) => {
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/resume/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        throw new Error('Could not optimize resume. Check backend connection.')
      }
      const result = await res.json()
      setResumePolished(result.polished_fields)
      setMessages(prev => [...prev, { sender: 'bot', text: "✨ Boom! Your ATS-Optimized resume is ready below! Review, make adjustments if needed, and apply to screening." }])
    } catch (e) {
      setError(e.message)
      // Fallback: construct standard text without AI rewrite
      const fallback = { ...data }
      setResumePolished(fallback)
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (field, val) => {
    setResumePolished(prev => ({ ...prev, [field]: val }))
  }

  const handleApply = () => {
    if (onGenerateSuccess && resumePolished) {
      onGenerateSuccess(resumePolished)
    }
  }

  const handleDownloadDocx = () => {
    // Trigger download direct from API
    window.open(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'}/resume/download/docx`, '_blank')
  }

  const handleReset = () => {
    setStepIndex(0)
    setFormData({})
    setMessages([{ sender: 'bot', text: CHAT_STEPS[0].prompt }])
    setInputVal('')
    setResumePolished(null)
    setIsEditing(false)
    setError('')
  }

  return (
    <div className="conversational-container card">
      <h2>Create Resume with AI Assistant</h2>
      <p className="card-hint">
        Chat with our NLP agent to write, polish, and layout an ATS-compliant resume automatically.
      </p>

      {/* Chat Messages Log */}
      <div className="chat-window">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble-container ${m.sender}`}>
            <div className="chat-avatar">
              {m.sender === 'bot' ? '🤖' : '👤'}
            </div>
            <div className={`chat-bubble ${m.sender}`}>
              <p>{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble-container bot">
            <div className="chat-avatar">🤖</div>
            <div className="chat-bubble bot typing">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Area */}
      {stepIndex < CHAT_STEPS.length && (
        <form onSubmit={handleSend} className="chat-input-bar">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={CHAT_STEPS[stepIndex].placeholder}
            disabled={loading}
            autoFocus
          />
          {CHAT_STEPS[stepIndex].optional && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setInputVal('skipped')
                setTimeout(() => handleSend(), 50)
              }}
              disabled={loading}
            >
              Skip
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            Send
          </button>
        </form>
      )}

      {error && <div className="error" style={{ marginTop: '1rem' }}>{error}</div>}

      {/* Polished Resume Preview and Actions */}
      {resumePolished && (
        <div className="polished-preview-card">
          <div className="preview-header">
            <h3>Resume Preview (ATS Compliant Layout)</h3>
            <div className="actions" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? 'View Mode' : 'Edit Resume'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadDocx}
              >
                📥 Download Word (DOCX)
              </button>
            </div>
          </div>

          {isEditing ? (
            <div className="form-grid edit-grid">
              <label>
                Full Name
                <input
                  value={resumePolished.full_name || ''}
                  onChange={(e) => handleFieldChange('full_name', e.target.value)}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={resumePolished.email || ''}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                />
              </label>
              <label>
                Phone
                <input
                  value={resumePolished.phone || ''}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                />
              </label>
              <label>
                Preferred Role
                <input
                  value={resumePolished.preferred_role || ''}
                  onChange={(e) => handleFieldChange('preferred_role', e.target.value)}
                />
              </label>
              <label className="full-width">
                Summary
                <textarea
                  value={resumePolished.summary || ''}
                  onChange={(e) => handleFieldChange('summary', e.target.value)}
                  rows={4}
                />
              </label>
              <label className="full-width">
                Skills
                <textarea
                  value={resumePolished.skills || ''}
                  onChange={(e) => handleFieldChange('skills', e.target.value)}
                  rows={2}
                />
              </label>
              <label className="full-width">
                Experience
                <textarea
                  value={resumePolished.experience || ''}
                  onChange={(e) => handleFieldChange('experience', e.target.value)}
                  rows={6}
                />
              </label>
              <label className="full-width">
                Education
                <textarea
                  value={resumePolished.education || ''}
                  onChange={(e) => handleFieldChange('education', e.target.value)}
                  rows={3}
                />
              </label>
            </div>
          ) : (
            <div className="ats-doc-layout">
              <div className="doc-header">
                <h2>{resumePolished.full_name}</h2>
                <p>
                  {resumePolished.email} &bull; {resumePolished.phone} 
                  {resumePolished.linkedin && ` &bull; ${resumePolished.linkedin}`} 
                  {resumePolished.github && ` &bull; ${resumePolished.github}`}
                </p>
              </div>

              {resumePolished.summary && (
                <div className="doc-section">
                  <h4>Professional Summary</h4>
                  <p>{resumePolished.summary}</p>
                </div>
              )}

              {resumePolished.skills && (
                <div className="doc-section">
                  <h4>Core Competencies</h4>
                  <p>{resumePolished.skills}</p>
                </div>
              )}

              {resumePolished.experience && (
                <div className="doc-section">
                  <h4>Work Experience</h4>
                  <p style={{ whiteSpace: 'pre-line' }}>{resumePolished.experience}</p>
                </div>
              )}

              {resumePolished.education && (
                <div className="doc-section">
                  <h4>Education</h4>
                  <p style={{ whiteSpace: 'pre-line' }}>{resumePolished.education}</p>
                </div>
              )}
            </div>
          )}

          <div className="actions" style={{ justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              Clear & Restart Chat
            </button>
            <button type="button" className="btn btn-primary" onClick={handleApply}>
              Use For ATS Screening &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
