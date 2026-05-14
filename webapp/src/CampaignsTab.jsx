import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, Mail, Clock, CheckCircle, XCircle, X } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

export default function CampaignsTab() {
  const [subTab, setSubTab] = useState('send');
  const [templates, setTemplates] = useState([]);
  const [lists, setLists] = useState([]);
  const [emailStatuses, setEmailStatuses] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedLists, setSelectedLists] = useState([]); // array of list IDs
  const [emailField, setEmailField] = useState('work');
  const [emailStatusFilter, setEmailStatusFilter] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

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
        body: JSON.stringify({ template_id: parseInt(selectedTemplate), list_ids: selectedLists.map(Number), email_field: emailField, email_status_filter: emailStatusFilter })
      });
      const result = await res.json();
      if (!result.success) { alert(result.error); setSending(false); return; }

      const evtSource = new EventSource(`${API_BASE}/campaigns/${result.campaignId}/progress`);
      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        setProgress(data);
        if (data.status === 'completed' || data.status === 'failed') {
          evtSource.close(); setSending(false); refreshCampaigns();
        }
      };
      evtSource.onerror = () => { evtSource.close(); setSending(false); refreshCampaigns(); };
    } catch (err) { alert(err.message); setSending(false); }
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
              <label className="filter-label">Email Type</label>
              <select className="input-styled select-styled" value={emailField} onChange={e => setEmailField(e.target.value)}>
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

            {progress && (
              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <span>Progress: {progress.sent_count + progress.failed_count} / {progress.total_emails}</span>
                  <span>{pct}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), #3b82f6)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#10b981' }}>✓ Sent: {progress.sent_count}</span>
                  <span style={{ color: '#ef4444' }}>✗ Failed: {progress.failed_count}</span>
                  <span style={{ color: 'var(--text-muted)' }}>Status: {progress.status}</span>
                </div>
              </div>
            )}

            <button className="btn" onClick={handleSend} disabled={sending || !selectedTemplate || selectedLists.length === 0}
              style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', background: sending ? 'var(--bg-secondary)' : 'var(--accent-glow)', color: 'var(--accent-light)', border: '1px solid var(--accent)', fontSize: '1rem' }}>
              {sending ? <><Loader2 className="animate-spin" size={18} /> Sending...</> : <><Send size={18} /> Launch Campaign</>}
            </button>
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
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>List: {c.list_name || `#${c.list_id}`} • From: {c.sender_name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString()} • {c.email_field} email</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    {c.status === 'completed' ? <CheckCircle size={18} color="#10b981" /> : c.status === 'sending' ? <Loader2 className="animate-spin" size={18} color="var(--accent)" /> : <XCircle size={18} color="#ef4444" />}
                    <span style={{ color: c.status === 'completed' ? '#10b981' : c.status === 'sending' ? 'var(--accent-light)' : '#ef4444', fontWeight: 600, textTransform: 'capitalize' }}>{c.status}</span>
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
