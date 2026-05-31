import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Loader2, Clock, CheckCircle, XCircle, X, Send, Save, FileText } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export default function WhatsappTab() {
  const [subTab, setSubTab] = useState('send');
  const [lists, setLists] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [selectedLists, setSelectedLists] = useState([]); // array of list IDs
  const [templateParams, setTemplateParams] = useState('full_name');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [lRes, cRes, tRes] = await Promise.all([
          fetch(`${API_BASE}/lists`),
          fetch(`${API_BASE}/whatsapp/campaigns`),
          fetch(`${API_BASE}/whatsapp/templates`)
        ]);
        setLists(await lRes.json());
        setCampaigns(await cRes.json());
        setTemplates(await tRes.json());
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const refreshCampaigns = async () => {
    const res = await fetch(`${API_BASE}/whatsapp/campaigns`);
    setCampaigns(await res.json());
  };

  const handleTemplateSelect = (id) => {
    setSelectedTemplate(id);
    const t = templates.find(t => t.id === parseInt(id));
    if (t) {
        setCampaignName(t.campaign_name);
        setMediaUrl(t.media_url || '');
        setTemplateParams(t.template_params !== null && t.template_params !== undefined ? t.template_params : 'full_name');
    } else {
        setCampaignName('');
        setMediaUrl('');
        setTemplateParams('full_name');
    }
  };

  const handleSaveTemplate = async () => {
    if (!campaignName) return alert('Campaign name is required to save a template.');
    const templateName = prompt("Enter a name for this WhatsApp template:");
    if (!templateName) return;

    setIsSavingTemplate(true);
    try {
      const res = await fetch(`${API_BASE}/whatsapp/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          template_name: templateName, 
          campaign_name: campaignName, 
          media_url: mediaUrl,
          template_params: templateParams
        })
      });
      const result = await res.json();
      if (result.success) {
        alert('Template saved successfully!');
        const tRes = await fetch(`${API_BASE}/whatsapp/templates`);
        setTemplates(await tRes.json());
        setSelectedTemplate(result.id);
      } else {
        alert(`Failed to save template: ${result.error}`);
      }
    } catch (err) {
      alert(`Error saving template: ${err.message}`);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const toggleList = (listId) => {
    setSelectedLists(prev =>
      prev.includes(listId) ? prev.filter(id => id !== listId) : [...prev, listId]
    );
  };

  const handleSend = async () => {
    if (!campaignName || selectedLists.length === 0) return alert('Enter a campaign name and select at least one list');
    setSending(true); setProgress(null);
    try {
      const res = await fetch(`${API_BASE}/whatsapp/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            campaignName: campaignName, 
            list_ids: selectedLists.map(Number), 
            mediaUrl: mediaUrl,
            templateParams: templateParams
        })
      });
      const result = await res.json();
      if (!result.success) { alert(result.error); setSending(false); return; }

      const evtSource = new EventSource(`${API_BASE}/whatsapp/campaigns/${result.campaignId}/progress`);
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

  const pct = progress ? Math.round(((progress.sent_count + progress.failed_count) / progress.total_messages) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {['send', 'templates', 'history'].map(t => (
          <button key={t} className="btn" onClick={() => setSubTab(t)} style={{
            background: subTab === t ? 'var(--accent-glow)' : 'var(--bg-glass)',
            color: subTab === t ? 'var(--accent-light)' : 'var(--text-secondary)',
            border: subTab === t ? '1px solid var(--accent)' : '1px solid var(--border-glass)',
            textTransform: 'capitalize'
          }}>
            {t === 'send' ? <MessageCircle size={16} /> : t === 'templates' ? <FileText size={16} /> : <Clock size={16} />} {t === 'send' ? 'New Campaign' : t === 'templates' ? 'Templates' : 'History'}
          </button>
        ))}
      </div>

      {subTab === 'send' && (
        <div style={{ maxWidth: '700px' }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageCircle size={20} color="var(--accent-light)" /> Send WhatsApp Campaign
            </h2>

            <div className="filter-group">
              <label className="filter-label">Load Template</label>
              <select className="input-styled select-styled" value={selectedTemplate} onChange={e => handleTemplateSelect(e.target.value)}>
                <option value="">-- Start from scratch --</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Campaign Name (AiSensy Template Name)</label>
              <input 
                type="text" 
                className="input-styled" 
                placeholder="e.g. TASC1and2" 
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Media URL (Optional)</label>
              <input 
                type="text" 
                className="input-styled" 
                placeholder="https://..." 
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Template Parameters (Comma-separated)</label>
              <input 
                type="text" 
                className="input-styled" 
                placeholder="Leave blank for 0 parameters, or default: full_name" 
                value={templateParams}
                onChange={e => setTemplateParams(e.target.value)}
              />
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
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Only contacts with a valid personal phone number and name will receive messages.
              </p>
            </div>

            {progress && (
              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <span>Progress: {progress.sent_count + progress.failed_count} / {progress.total_messages}</span>
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

            <button className="btn" onClick={handleSend} disabled={sending || !campaignName || selectedLists.length === 0}
              style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', background: sending ? 'var(--bg-secondary)' : 'var(--accent-glow)', color: 'var(--accent-light)', border: '1px solid var(--accent)', fontSize: '1rem' }}>
              {sending ? <><Loader2 className="animate-spin" size={18} /> Sending...</> : <><Send size={18} /> Launch Campaign</>}
            </button>
          </div>
        </div>
      )}

      {subTab === 'templates' && (
        <div style={{ maxWidth: '700px' }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} color="var(--accent-light)" /> Create WhatsApp Template
            </h2>
            <div className="filter-group">
              <label className="filter-label">Template Name (Internal)</label>
              <input type="text" className="input-styled" id="new_template_name" placeholder="e.g. Welcome Message" />
            </div>
            <div className="filter-group">
              <label className="filter-label">Campaign Name (AiSensy Template Name)</label>
              <input type="text" className="input-styled" id="new_campaign_name" placeholder="e.g. TASC1and2" />
            </div>
            <div className="filter-group">
              <label className="filter-label">Media URL (Optional)</label>
              <input type="text" className="input-styled" id="new_media_url" placeholder="https://..." />
            </div>
            <div className="filter-group">
              <label className="filter-label">Template Parameters (Comma-separated)</label>
              <input type="text" className="input-styled" id="new_template_params" placeholder="Leave blank for 0 parameters, or default: full_name" defaultValue="full_name" />
            </div>
            <button className="btn" onClick={async () => {
              const tName = document.getElementById('new_template_name').value;
              const cName = document.getElementById('new_campaign_name').value;
              const mUrl = document.getElementById('new_media_url').value;
              const tParams = document.getElementById('new_template_params').value;
              if (!tName || !cName) return alert('Template Name and Campaign Name are required.');
              
              setIsSavingTemplate(true);
              try {
                const res = await fetch(`${API_BASE}/whatsapp/templates`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ template_name: tName, campaign_name: cName, media_url: mUrl, template_params: tParams })
                });
                const result = await res.json();
                if (result.success) {
                  alert('Template created successfully!');
                  document.getElementById('new_template_name').value = '';
                  document.getElementById('new_campaign_name').value = '';
                  document.getElementById('new_media_url').value = '';
                  document.getElementById('new_template_params').value = 'full_name';
                  const tRes = await fetch(`${API_BASE}/whatsapp/templates`);
                  setTemplates(await tRes.json());
                } else {
                  alert(`Failed to save: ${result.error}`);
                }
              } catch (err) {
                alert(`Error: ${err.message}`);
              } finally {
                setIsSavingTemplate(false);
              }
            }} disabled={isSavingTemplate} style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', background: 'var(--accent-glow)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }}>
              {isSavingTemplate ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save Template
            </button>
          </div>

          <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>Saved Templates</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {templates.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No templates saved yet.</div>
            ) : templates.map(t => (
              <div key={t.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.1rem' }}>{t.template_name}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>AiSensy Name: {t.campaign_name} • Params: {t.template_params !== null && t.template_params !== undefined ? (t.template_params || '(none)') : 'full_name'}</p>
                  {t.media_url && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', wordBreak: 'break-all' }}>Media: {t.media_url}</p>}
                </div>
                <button className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={async () => {
                  if(!window.confirm('Delete this template?')) return;
                  await fetch(`${API_BASE}/whatsapp/templates/${t.id}`, { method: 'DELETE' });
                  const tRes = await fetch(`${API_BASE}/whatsapp/templates`);
                  setTemplates(await tRes.json());
                  if (selectedTemplate === String(t.id)) {
                      setSelectedTemplate('');
                      setCampaignName('');
                      setMediaUrl('');
                  }
                }}>
                  <X size={16} /> Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)' }}>WhatsApp Campaign History</h2>
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
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.1rem' }}>{c.name}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Lists: {c.target_lists || c.list_name || `#${c.list_id}`}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString()}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    {c.status === 'completed' ? <CheckCircle size={18} color="#10b981" /> : c.status === 'sending' ? <Loader2 className="animate-spin" size={18} color="var(--accent)" /> : <XCircle size={18} color="#ef4444" />}
                    <span style={{ color: c.status === 'completed' ? '#10b981' : c.status === 'sending' ? 'var(--accent-light)' : '#ef4444', fontWeight: 600, textTransform: 'capitalize' }}>{c.status}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#10b981' }}>{c.sent_count}</span> sent • <span style={{ color: '#ef4444' }}>{c.failed_count}</span> failed / {c.total_messages} total
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
