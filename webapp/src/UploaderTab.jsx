import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Loader2, CheckCircle, AlertCircle, FileSpreadsheet, Database, ShieldCheck, Zap, Activity, Info } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

const UploaderTab = () => {
    const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
    const [progress, setProgress] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [dragActive, setDragActive] = useState(false);

    const handleFilesSelect = (fileList) => {
        const validFiles = Array.from(fileList).filter(f => {
            const name = f.name.toLowerCase();
            return name.endsWith('.csv') || name.endsWith('.xls') || name.endsWith('.xlsx');
        });
        if (validFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...validFiles]);
            setStatus('idle');
            setProgress(null);
            setErrorMsg('');
        } else {
            setStatus('error');
            setErrorMsg('Please select valid .csv, .xls, or .xlsx files only.');
        }
    };

    const onDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesSelect(e.dataTransfer.files);
        }
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;

        setStatus('uploading');
        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                setStatus('processing');
                startProgressTracking();
            } else {
                setStatus('error');
                setErrorMsg(data.error || 'Upload failed');
            }
        } catch (err) {
            setStatus('error');
            setErrorMsg(err.message);
        }
    };

    const startProgressTracking = () => {
        const eventSource = new EventSource(`${API_BASE}/upload/progress`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setProgress(data);

            if (data.status === 'completed') {
                setStatus('completed');
                eventSource.close();
            } else if (data.status === 'error') {
                setStatus('error');
                setErrorMsg(data.error);
                eventSource.close();
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            if (status !== 'completed') {
                setStatus('error');
                setErrorMsg('Lost connection to server during processing.');
            }
        };
    };

    const resetUploader = () => {
        setSelectedFiles([]);
        setStatus('idle');
        setProgress(null);
        setErrorMsg('');
    };

    const pieData = progress ? [
        { name: 'Successfully Inserted', value: progress.inserted, color: '#10b981' },
        { name: 'Skipped Duplicates', value: progress.skipped, color: '#f59e0b' }
    ] : [];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem', width: '100%' }}>
                
                {/* Left Column: Upload Interface */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    <div className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div className="stat-icon" style={{ background: 'var(--accent-glow)' }}>
                                <Database size={28} color="var(--accent-light)" />
                            </div>
                            <div>
                                <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.5rem' }}>Data Injection Hub</h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>Bulk import contacts via CSV or Excel payload</p>
                            </div>
                        </div>

                        <div className="glass-card" style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', marginBottom: '2rem', padding: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                <Info size={20} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div>
                                    <h4 style={{ color: '#38bdf8', marginBottom: '0.25rem', fontSize: '0.95rem' }}>Smart Duplicate Protection Enabled</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                        The system uses <strong>person_linkedin_url</strong> as a unique identifier. Any rows containing a LinkedIn URL that already exists in the database will be automatically skipped to maintain data integrity.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div 
                            onDragEnter={onDrag}
                            onDragLeave={onDrag}
                            onDragOver={onDrag}
                            onDrop={onDrop}
                            style={{ 
                                border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--border-glass)'}`, 
                                borderRadius: '16px', 
                                padding: '4rem 2rem', 
                                textAlign: 'center', 
                                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', 
                                background: dragActive ? 'var(--accent-glow)' : (selectedFiles.length > 0) ? 'rgba(255,255,255,0.02)' : 'transparent',
                                cursor: 'pointer',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                            onClick={() => document.getElementById('csv-upload').click()}
                        >
                            <input 
                                type="file" 
                                accept=".csv, .xls, .xlsx" 
                                id="csv-upload" 
                                multiple
                                style={{ display: 'none' }} 
                                onChange={(e) => { if (e.target.files) handleFilesSelect(e.target.files) }}
                                disabled={status === 'uploading' || status === 'processing'}
                            />
                            
                            <motion.div 
                                animate={{ y: dragActive ? -10 : 0, scale: dragActive ? 1.1 : 1 }}
                                className="stat-icon" 
                                style={{ background: selectedFiles.length > 0 ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-secondary)', width: '80px', height: '80px', borderRadius: '50%', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                {selectedFiles.length > 0 ? <FileSpreadsheet size={40} color="#10b981" /> : <Upload size={40} color={dragActive ? 'var(--accent-light)' : 'var(--text-muted)'} />}
                            </motion.div>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', marginBottom: '0.5rem' }}>
                                {selectedFiles.length > 0 ? `${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''} Selected` : 'Drag & Drop Data Payload'}
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '300px' }}>
                                {selectedFiles.length > 0 ? 
                                    `${(selectedFiles.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB total • Ready for processing` 
                                    : 'or click here to select multiple files'}
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', alignItems: 'center' }}>
                            {selectedFiles.length > 0 && status !== 'processing' && status !== 'uploading' ? (
                                <button className="btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); resetUploader(); }}>
                                    Clear Selection
                                </button>
                            ) : <div></div>}
                            
                            <button 
                                className="btn" 
                                style={{ 
                                    padding: '1rem 2.5rem', 
                                    fontSize: '1.1rem', 
                                    fontWeight: 600,
                                    background: 'var(--accent-glow)', 
                                    color: 'var(--accent-light)', 
                                    border: '1px solid var(--accent)',
                                    borderRadius: '8px',
                                    opacity: (selectedFiles.length === 0 || status === 'uploading' || status === 'processing') ? 0.5 : 1
                                }}
                                onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                                disabled={selectedFiles.length === 0 || status === 'uploading' || status === 'processing'}
                            >
                                {status === 'uploading' ? 'Transmitting...' : status === 'processing' ? 'Processing...' : 'Initialize Import'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Progress & Telemetry */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    <AnimatePresence mode="wait">
                        {status === 'idle' && !errorMsg && (
                            <motion.div key="idle" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '4rem 2rem' }}>
                                <Activity size={48} color="var(--border-glass)" style={{ marginBottom: '1.5rem' }} />
                                <h3 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: 500 }}>Awaiting Payload Injection</h3>
                                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', lineHeight: 1.6 }}>
                                    Select a CSV, XLS, or XLSX file on the left to begin. Telemetry and progress statistics will appear here in real-time during the import sequence.
                                </p>
                            </motion.div>
                        )}

                        {errorMsg && status === 'error' && (
                            <motion.div key="error" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', color: '#ef4444' }}>
                                    <AlertCircle size={32} />
                                    <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Import Failure</h2>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6 }}>
                                    {errorMsg}
                                </p>
                                <button className="btn" style={{ marginTop: '2rem', alignSelf: 'flex-start' }} onClick={resetUploader}>
                                    Acknowledge & Reset
                                </button>
                            </motion.div>
                        )}

                        {(status === 'processing' || status === 'completed') && progress && (
                            <motion.div key="active" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
                                    <div>
                                        <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            {status === 'processing' ? <Loader2 className="animate-spin" size={24} color="var(--accent)" /> : <CheckCircle size={24} color="#10b981" />}
                                            {status === 'processing' ? 'Processing Stream...' : 'Import Finalized'}
                                        </h2>
                                        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
                                            {status === 'processing' ? 'Streaming rows to SQLite database' : 'All rows have been processed'}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                                            {progress.total.toLocaleString()}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Processed</div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                                    <div style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '1rem' }}>
                                            <ShieldCheck size={20} />
                                            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Successfully Inserted</span>
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                                            {progress.inserted.toLocaleString()}
                                        </div>
                                    </div>
                                    
                                    <div style={{ padding: '1.5rem', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', marginBottom: '1rem' }}>
                                            <Zap size={20} />
                                            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Duplicates Skipped</span>
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>
                                            {progress.skipped.toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ flex: 1, minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
                                    <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '1rem' }}>Distribution</h4>
                                    <div style={{ flex: 1, position: 'relative' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={90}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    stroke="none"
                                                    animationDuration={500}
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip 
                                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                                                    itemStyle={{ color: 'var(--text-primary)' }}
                                                    formatter={(value) => value.toLocaleString()}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        
                                        {/* Center Text in Pie Chart */}
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                            <div style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700, fontFamily: 'Outfit' }}>
                                                {progress.total > 0 ? Math.round((progress.inserted / progress.total) * 100) : 0}%
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Success Rate</div>
                                        </div>
                                    </div>
                                </div>

                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>
            </div>
        </motion.div>
    );
};

export default UploaderTab;
