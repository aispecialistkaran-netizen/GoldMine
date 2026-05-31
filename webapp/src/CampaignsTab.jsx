import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, Mail, Clock, CheckCircle, XCircle, X, Users, Eye, StopCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export default function CampaignsTab() {
  const [subTab, setSubTab] = useState('send');
  const [templates, setTemplates] = useState([]);
  const [lists, setLists] = useState([]);
  const [emailStatuses, setEmailStatuses] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedLists, setSelectedLists] = useState([]); // array of list IDs
  const [emailField, setEmailField] = useState('email1');
  const [emailTypeFilter, setEmailTypeFilter] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  // Preview state
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Active campaign ID for stop functionality
  const [activeCampaignId, setActiveCampaignId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [tRes, lRes, fRes, cRes] = await Promise.all([
          fetch(`${API_BASE}/templates`), fetch(`${API_BASE}/lists`),
          fetch(`${API_BASE}/filters`), fetch(`${API_BASE}/campaigns`)
        ]);
        setTemplates(await tRes.json());
        setLists(await lRes.json());
        const filters = await fRes.json();
        setEmailStatuses(filters.emailStatuses || []);
        setCampaigns(await cRes.json());
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // Auto-preview when selection changes
  useEffect(() => {
    if (selectedLists.length > 0) {
      fetchPreview();
    } else {
      setPreviewCount(null);
    }
  }, [selectedLists, emailField, emailTypeFilter, emailStatusFilter]);

  const fetchPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/campaigns/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_ids: selectedLists.map(Number), email_field: emailField, email_type_filter: emailTypeFilter, email_status_filter: emailStatusFilter })
      });
      const data = await res.json();
      setPreviewCount(data.count);
    } catch (err) { console.error(err); }
    finally { setPreviewLoading(false); }
  };

  const refreshCampaigns = async () => {
    const res = await fetch(`${API_BASE}/campaigns`);
    setCampaigns(await res.json());
  };

  const toggleList = (listId) => {
    setSelectedLists(prev =>
      prev.includes(listId) ? prev.filter(id => id !== listId) : [...prev, listId]
    );
  };

  const handleSend = async () => {
    if (!selectedTemplate || selectedLists.length === 0) return alert('Select a template and at least one list');
    setSending(true); setProgress(null);
    try {
      const res = await fetch(`${API_BASE}/campaigns/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: parseInt(selectedTemplate), list_ids: selectedLists.map(Number), email_field: emailField, email_type_filter: emailTypeFilter, email_status_filter: emailStatusFilter })
      });
      const result = await res.json();
      if (!result.success) { alert(result.error); setSending(false); return; }

      setActiveCampaignId(result.campaignId);

      const evtSource = new EventSource(`${API_BASE}/campaigns/${result.campaignId}/progress`);
      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        setProgress(data);
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
          evtSource.close(); setSending(false); setActiveCampaignId(null); refreshCampaigns();
        }
      };
      evtSource.onerror = () => { evtSource.close(); setSending(false); setActiveCampaignId(null); refreshCampaigns(); };
    } catch (err) { alert(err.message); setSending(false); }
  };

  const handleStop = async () => {
    if (!activeCampaignId) return;
    if (!window.confirm('Are you sure you want to stop this campaign? Emails already sent cannot be undone.')) return;
    try {
      await fetch(`${API_BASE}/campaigns/${activeCampaignId}/stop`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop campaign:', err);
    }
  };

  const pct = progress ? Math.round(((progress.sent_count + progress.failed_count) / progress.total_emails) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {['send', 'history'].map(t => (
          <button key={t} className="btn" onClick={() => setSubTab(t)} style={{
            background: subTab === t ? 'var(--accent-glow)' : 'var(--bg-glass)',
            color: subTab === t ? 'var(--accent-light)' : 'var(--text-secondary)',
            border: subTab === t ? '1px solid var(--accent)' : '1px solid var(--border-glass)',
            textTransform: 'capitalize'
          }}>
            {t === 'send' ? <Send size={16} /> : <Clock size={16} />} {t === 'send' ? 'New Campaign' : 'History'}
          </button>
        ))}
      </div>

      {subTab === 'send' && (
        <div style={{ maxWidth: '700px' }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={20} color="var(--accent-light)" /> Send Email Campaign
            </h2>

            <div className="filter-group">
              <label className="filter-label">Select Template</label>
              <select className="input-styled select-styled" value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}>
                <option value="">Choose a template...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.subject} (by {t.sender_name})</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Select Lists ({selectedLists.length} selected)</label>
              {selectedLists.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {selectedLists.map(id => {
                    const list = lists.find(l => l.id === id);
                    return list ? (
                      <span key={id} className="tag accent" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.6rem', cursor: 'pointer' }} onClick={() => toggleList(id)}>
                        {list.name} ({list.count}) <X size={12} />
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-glass)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                {lists.map(l => (
                  <div key={l.id} onClick={() => toggleList(l.id)} style={{
                    padding: '0.6rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: selectedLists.includes(l.id) ? 'var(--accent-glow)' : 'transparent',
                    borderBottom: '1px solid var(--border-glass)', transition: 'background 0.15s'
                  }}>
                    <span style={{ color: selectedLists.includes(l.id) ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.9rem' }}>{l.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{l.count} contacts</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <label className="filter-label">Email Source</label>
              <select className="input-styled select-styled" value={emailField} onChange={e => setEmailField(e.target.value)}>
                <option value="email1">Email 1</option>
                <option value="email2">Email 2</option>
                <option value="email3">Email 3</option>
                <option value="email4">Email 4</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Email Type</label>
              <select className="input-styled select-styled" value={emailTypeFilter} onChange={e => setEmailTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                <option value="work">Work Email</option>
                <option value="personal">Personal Email</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Email Status</label>
              <select className="input-styled select-styled" value={emailStatusFilter} onChange={e => setEmailStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {emailStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Recipient Preview */}
            {selectedLists.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }} 
                animate={{ opacity: 1, y: 0 }}
                style={{ 
                  padding: '1rem 1.25rem', 
                  background: 'rgba(139, 92, 246, 0.08)', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '10px', 
                    background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' 
                  }}>
                    <Users size={20} color="var(--accent-light)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Estimated Recipients
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                      {previewLoading ? (
                        <Loader2 className="animate-spin" size={20} color="var(--accent)" />
                      ) : previewCount !== null ? (
                        previewCount.toLocaleString()
                      ) : '—'}
                    </div>
                  </div>
                </div>
                <button 
                  className="btn" 
                  onClick={fetchPreview} 
                  disabled={previewLoading}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--accent-light)', background: 'transparent', border: '1px solid rgba(139, 92, 246, 0.3)' }}
                >
                  <Eye size={14} /> Refresh
                </button>
              </motion.div>
            )}

            {progress && (
              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <span>Progress: {progress.sent_count + progress.failed_count} / {progress.total_emails}</span>
                  <span>{pct}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: progress.status === 'stopped' ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, var(--accent), #3b82f6)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#10b981' }}>✓ Sent: {progress.sent_count}</span>
                  <span style={{ color: '#ef4444' }}>✗ Failed: {progress.failed_count}</span>
                  <span style={{ color: progress.status === 'stopped' ? '#f59e0b' : 'var(--text-muted)' }}>
                    Status: {progress.status === 'stopped' ? '⏹ Stopped' : progress.status}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn" onClick={handleSend} disabled={sending || !selectedTemplate || selectedLists.length === 0}
                style={{ flex: 1, justifyContent: 'center', padding: '0.85rem', background: sending ? 'var(--bg-secondary)' : 'var(--accent-glow)', color: 'var(--accent-light)', border: '1px solid var(--accent)', fontSize: '1rem' }}>
                {sending ? <><Loader2 className="animate-spin" size={18} /> Sending...</> : <><Send size={18} /> Launch Campaign</>}
              </button>

              {sending && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="btn" 
                  onClick={handleStop}
                  style={{ 
                    padding: '0.85rem 1.25rem', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    color: '#ef4444', 
                    border: '1px solid rgba(239, 68, 68, 0.3)', 
                    fontSize: '1rem',
                    justifyContent: 'center'
                  }}
                >
                  <StopCircle size={18} /> Stop
                </motion.button>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)' }}>Campaign History</h2>
          {loading ? (
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={32} color="var(--accent)" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No campaigns sent yet.</div>
          ) : campaigns.map(c => (
            <motion.div key={c.id} className="glass-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.1rem' }}>{c.template_subject || c.name || 'Campaign'}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Lists: {c.target_lists || c.list_name || `#${c.list_id}`} • From: {c.sender_name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString()} • {c.email_field} email</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    {c.status === 'completed' ? <CheckCircle size={18} color="#10b981" /> : c.status === 'sending' ? <Loader2 className="animate-spin" size={18} color="var(--accent)" /> : c.status === 'stopped' ? <StopCircle size={18} color="#f59e0b" /> : <XCircle size={18} color="#ef4444" />}
                    <span style={{ color: c.status === 'completed' ? '#10b981' : c.status === 'sending' ? 'var(--accent-light)' : c.status === 'stopped' ? '#f59e0b' : '#ef4444', fontWeight: 600, textTransform: 'capitalize' }}>{c.status}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#10b981' }}>{c.sent_count}</span> sent • <span style={{ color: '#ef4444' }}>{c.failed_count}</span> failed / {c.total_emails} total
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
