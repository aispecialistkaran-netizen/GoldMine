import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Trash2, FileText, Loader2, Pencil, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export default function TemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [senderName, setSenderName] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null = create mode, number = edit mode

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/templates`);
      setTemplates(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTemplates(); }, []);

  const clearForm = () => {
    setSenderName(''); setSubject(''); setHtmlBody(''); setEditingId(null);
  };

  const handleEdit = (t) => {
    setSenderName(t.sender_name);
    setSubject(t.subject);
    setHtmlBody(t.html_body);
    setEditingId(t.id);
  };

  const handleSave = async () => {
    if (!senderName || !subject || !htmlBody) return alert('All fields are required');
    setSaving(true);
    try {
      const url = editingId ? `${API_BASE}/templates/${editingId}` : `${API_BASE}/templates`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_name: senderName, subject, html_body: htmlBody })
      });
      const result = await res.json();
      if (result.success) {
        clearForm();
        loadTemplates();
      }
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`${API_BASE}/templates/${id}`, { method: 'DELETE' });
    if (editingId === id) clearForm();
    loadTemplates();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--accent-light)" /> {editingId ? 'Edit Template' : 'Create Template'}
          </h2>
          {editingId && (
            <button className="btn" onClick={clearForm} style={{ padding: '0.4rem', color: 'var(--text-muted)' }}><X size={16} /> Cancel</button>
          )}
        </div>
        <div className="filter-group">
          <label className="filter-label">Sender Name</label>
          <input className="input-styled" placeholder="John from xMonks" value={senderName} onChange={e => setSenderName(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label">Subject Line</label>
          <input className="input-styled" placeholder="Use {{name}}, {{company}} for personalization" value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="filter-label">HTML Body</label>
          <textarea className="input-styled" rows={14} placeholder="<h1>Hello {{name}}</h1><p>We'd love to connect with {{company}}...</p>" value={htmlBody} onChange={e => setHtmlBody(e.target.value)} style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }} />
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Variables: {'{{name}}'}, {'{{company}}'}, {'{{position}}'}, {'{{city}}'}, {'{{country}}'}, {'{{industry}}'}</p>
        <button className="btn" style={{ width: '100%', background: 'var(--accent-glow)', color: 'var(--accent-light)', border: '1px solid var(--accent)', justifyContent: 'center', padding: '0.75rem' }} onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : editingId ? 'Update Template' : 'Save Template'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)' }}>Saved Templates ({templates.length})</h2>
        {loading ? (
          <div className="glass-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" size={32} color="var(--accent)" />
          </div>
        ) : templates.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No templates yet. Create one!</div>
        ) : templates.map(t => (
          <motion.div key={t.id} className="glass-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ border: editingId === t.id ? '1px solid var(--accent)' : undefined }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{t.subject}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>From: {t.sender_name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleString()}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" onClick={() => handleEdit(t)} style={{ color: 'var(--accent-light)', padding: '0.4rem' }}><Pencil size={16} /></button>
                <button className="btn" onClick={() => handleDelete(t.id)} style={{ color: '#ef4444', padding: '0.4rem' }}><Trash2 size={16} /></button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
