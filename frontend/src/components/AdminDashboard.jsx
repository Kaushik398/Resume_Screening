import { useState, useEffect } from 'react'

export default function AdminDashboard({ apiFetch }) {
  const [candidates, setCandidates] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modals / Detail Views
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [viewType, setViewType] = useState('') // 'resume' or 'test'

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    setError('')
    try {
      const cRes = await apiFetch('/candidates')
      const aRes = await apiFetch('/recruiter/analytics')
      
      if (!cRes.ok || !aRes.ok) {
        throw new Error('Failed to load dashboard data. Check if backend is active.')
      }
      
      const cData = await cRes.json()
      const aData = await aRes.json()
      
      setCandidates(cData)
      setAnalytics(aData)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleShortlist = async (candidateId) => {
    try {
      const res = await apiFetch(`/candidates/${candidateId}/shortlist`, {
        method: 'POST'
      })
      if (res.ok) {
        // Toggle locally
        setCandidates(prev =>
          prev.map(c => c.id === candidateId ? { ...c, shortlisted: !c.shortlisted } : c)
        )
        // Refresh analytics
        const aRes = await apiFetch('/recruiter/analytics')
        if (aRes.ok) {
          const aData = await aRes.json()
          setAnalytics(aData)
        }
      }
    } catch (e) {
      console.error("Error shortlisting:", e)
    }
  }

  const handleExportCSV = () => {
    // Generate CSV contents
    const headers = ["ID", "Name", "Email", "Role", "ATS Score", "Test Score", "Status", "Shortlisted", "Date"]
    const rows = candidates.map(c => [
      c.id,
      c.full_name,
      c.email,
      c.preferred_role,
      `${c.ats_score}%`,
      c.test_score !== null ? `${c.test_score}%` : 'N/A',
      c.match_status,
      c.shortlisted ? "Yes" : "No",
      c.created_at
    ])
    
    const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", "recruiter_candidates_report.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredCandidates = candidates.filter(c => {
    const term = searchQuery.toLowerCase()
    return (
      c.full_name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      c.preferred_role.toLowerCase().includes(term) ||
      c.match_status.toLowerCase().includes(term)
    )
  })

  if (loading) return <div className="loading">Loading Admin Panel...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="admin-dashboard">
      <h2>Recruiter Admin Dashboard</h2>
      <p className="card-hint">Manage candidate entries, analyze test reports, and shortlist top talent.</p>

      {/* Analytics Widgets Grid */}
      {analytics && (
        <div className="analytics-grid">
          <div className="analytics-card">
            <span className="card-icon">👥</span>
            <div>
              <h3>Total Candidates</h3>
              <p className="widget-num">{analytics.total_candidates}</p>
            </div>
          </div>
          <div className="analytics-card">
            <span className="card-icon" style={{ color: 'var(--success)' }}>✅</span>
            <div>
              <h3>Qualified Candidates</h3>
              <p className="widget-num">{analytics.qualified_candidates}</p>
            </div>
          </div>
          <div className="analytics-card">
            <span className="card-icon" style={{ color: 'var(--accent)' }}>📊</span>
            <div>
              <h3>Average ATS Score</h3>
              <p className="widget-num">{analytics.average_ats}%</p>
            </div>
          </div>
          <div className="analytics-card">
            <span className="card-icon" style={{ color: 'var(--warning)' }}>📝</span>
            <div>
              <h3>Tests Completed</h3>
              <p className="widget-num">{analytics.tests_completed}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Skills Distribution & Action Bar */}
      <div className="dashboard-layout-split">
        {analytics?.skills_distribution?.length > 0 && (
          <div className="card skills-dist-card">
            <h3>Top Skills Distribution</h3>
            <div className="skills-bar-chart">
              {analytics.skills_distribution.map((s, idx) => (
                <div key={idx} className="skill-bar-row">
                  <span className="skill-name">{s.skill}</span>
                  <div className="skill-bar-track">
                    <div 
                      className="skill-bar-fill" 
                      style={{ 
                        width: `${(s.count / analytics.total_candidates) * 100}%`,
                        background: 'linear-gradient(90deg, var(--accent) 0%, #818cf8 100%)'
                      }}
                    ></div>
                  </div>
                  <span className="skill-count">{s.count} candidates</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card control-actions-card" style={{ flex: 1 }}>
          <h3>Database Export & Controls</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Generate analytical CSV logs of your database records, or trigger a full synchronization of screening attempts.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={handleExportCSV}>
              📥 Export Candidates Database (CSV)
            </button>
            <button type="button" className="btn btn-secondary" onClick={fetchDashboardData}>
              🔄 Sync Database Records
            </button>
          </div>
        </div>
      </div>

      {/* Candidates List Database */}
      <div className="card candidate-list-card">
        <div className="list-header-row">
          <h3>Screened Candidates Database</h3>
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by name, role, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="candidate-table">
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Preferred Role</th>
                <th>ATS Score</th>
                <th>Test Score</th>
                <th>Match Status</th>
                <th>Shortlist</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No candidates found matching the query.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((c) => (
                  <tr key={c.id} className={c.shortlisted ? 'shortlisted-row' : ''}>
                    <td>
                      <div className="cand-info">
                        <strong>{c.full_name}</strong>
                        <span>{c.email}</span>
                      </div>
                    </td>
                    <td>{c.preferred_role}</td>
                    <td>
                      <span className={`ats-pill ${c.ats_score >= 75 ? 'high' : c.ats_score >= 50 ? 'med' : 'low'}`}>
                        {c.ats_score}%
                      </span>
                    </td>
                    <td>
                      {c.test_score !== null ? (
                        <span className={`test-pill ${c.test_score >= 70 ? 'pass' : 'fail'}`}>
                          {c.test_score}%
                        </span>
                      ) : (
                        <span className="no-test-label">No Test</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-tag ${c.match_status.toLowerCase().replace(' ', '_')}`}>
                        {c.match_status}
                      </span>
                    </td>
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={c.shortlisted}
                          onChange={() => toggleShortlist(c.id)}
                        />
                        <span className="slider round"></span>
                      </label>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-text-action"
                          onClick={() => {
                            setSelectedCandidate(c)
                            setViewType('resume')
                          }}
                        >
                          📄 Resume
                        </button>
                        {c.test_score !== null && (
                          <button
                            type="button"
                            className="btn-text-action accent"
                            onClick={() => {
                              setSelectedCandidate(c)
                              setViewType('test')
                            }}
                          >
                            📈 Test Report
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Candidate Modal Overlay */}
      {selectedCandidate && (
        <div className="modal-overlay" onClick={() => setSelectedCandidate(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {selectedCandidate.full_name} &mdash; {viewType === 'resume' ? 'Resume Content' : 'Assessment Report'}
              </h3>
              <button className="close-btn" onClick={() => setSelectedCandidate(null)}>&times;</button>
            </div>
            
            <div className="modal-body">
              {viewType === 'resume' ? (
                <div className="resume-raw-preview">
                  <pre>{selectedCandidate.resume_text}</pre>
                </div>
              ) : (
                <div className="test-detailed-feedback">
                  <div className="score-summary-box">
                    <div className="score-ring-lg">
                      {selectedCandidate.test_score}%
                      <span>Test Score</span>
                    </div>
                    <div>
                      <h4>Recommendation: {selectedCandidate.test_feedback?.recommendation_status || 'Recommended'}</h4>
                      <p>{selectedCandidate.test_feedback?.summary}</p>
                    </div>
                  </div>

                  {selectedCandidate.test_feedback?.radar_scores && (
                    <div style={{ background: 'var(--bg)', borderRadius: '12px', padding: '1rem', marginTop: '1rem' }}>
                      <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>Evaluation Sub-Dimensions</h4>
                      <div className="subscores-list">
                        <div className="subscore-item">
                          <span>Technical Skills</span>
                          <strong>{selectedCandidate.test_feedback.radar_scores.technical_skills}%</strong>
                        </div>
                        <div className="subscore-item">
                          <span>Problem Solving</span>
                          <strong>{selectedCandidate.test_feedback.radar_scores.problem_solving}%</strong>
                        </div>
                        <div className="subscore-item">
                          <span>Communication</span>
                          <strong>{selectedCandidate.test_feedback.radar_scores.communication}%</strong>
                        </div>
                        <div className="subscore-item">
                          <span>Domain Knowledge</span>
                          <strong>{selectedCandidate.test_feedback.radar_scores.domain_knowledge}%</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <h4 style={{ marginTop: '1.25rem' }}>Recruiter Recommendations</h4>
                  <ul className="rec-list">
                    {selectedCandidate.test_feedback?.recommendations?.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCandidate(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
