import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Building2, Briefcase, MapPin, Download, LogOut,
  Search, Filter, ChevronLeft, ChevronRight, Activity, LayoutDashboard, Contact, Phone, Mail, Loader2, Save, List, ArrowLeft, FileText, Send
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import TemplatesTab from './TemplatesTab';
import CampaignsTab from './CampaignsTab';
import LoginPage from './LoginPage';

import './index.css';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const API_BASE = 'http://localhost:3001/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('gld_auth') === 'true');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [emailTypeFilter, setEmailTypeFilter] = useState('');
  const [phoneTypeFilter, setPhoneTypeFilter] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState('');
  const [phoneStatusFilter, setPhoneStatusFilter] = useState('');
  const [emailSourceFilter, setEmailSourceFilter] = useState('email1');
  const [companyFilter, setCompanyFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  
  const [page, setPage] = useState(1);
  const rowsPerPage = 12;

  // Data states
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  
  const [stats, setStats] = useState({
    totalContacts: 0,
    uniqueCompanies: 0,
    topIndustries: [],
    topCountries: []
  });

  const [availableFilters, setAvailableFilters] = useState({
    industries: [],
    countries: [],
    emailStatuses: [],
    phoneStatuses: [],
    phoneTypes: []
  });

  // Lists state
  const [savedLists, setSavedLists] = useState([]);
  const [activeList, setActiveList] = useState(null); // null means showing all lists, otherwise ID
  const [isSavingList, setIsSavingList] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setPage(1); // Reset page on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load Filters & Stats on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [statsRes, filtersRes] = await Promise.all([
          fetch(`${API_BASE}/stats`),
          fetch(`${API_BASE}/filters`)
        ]);
        
        const statsData = await statsRes.json();
        const filtersData = await filtersRes.json();

        setStats(statsData);
        setAvailableFilters(filtersData);
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };
    loadInitialData();
  }, []);

  // Load Contacts when dependencies change
  useEffect(() => {
    if (activeTab === 'contacts') {
      const loadContacts = async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams({
            page,
            limit: rowsPerPage,
            search: searchTerm,
            industry: industryFilter,
            country: countryFilter,
            emailType: emailTypeFilter,
            phoneType: phoneTypeFilter,
            emailStatus: emailStatusFilter,
            phoneStatus: phoneStatusFilter,
            company: companyFilter,
            position: positionFilter,
            city: cityFilter,
            emailSource: emailSourceFilter
          });
          
          const res = await fetch(`${API_BASE}/contacts?${params.toString()}`);
          const result = await res.json();
          
          setData(result.data || []);
          setTotalRecords(result.total || 0);
        } catch (err) {
          console.error("Failed to load contacts:", err);
        } finally {
          setLoading(false);
        }
      };
      loadContacts();
    } else if (activeTab === 'lists' && activeList) {
      // Load contacts for a specific list
      const loadListContacts = async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE}/lists/${activeList}/contacts?page=${page}&limit=${rowsPerPage}`);
          const result = await res.json();
          setData(result.data || []);
          setTotalRecords(result.total || 0);
        } catch (err) {
          console.error("Failed to load list contacts:", err);
        } finally {
          setLoading(false);
        }
      };
      loadListContacts();
    }
  }, [page, searchTerm, industryFilter, countryFilter, emailTypeFilter, phoneTypeFilter, emailStatusFilter, phoneStatusFilter, emailSourceFilter, companyFilter, positionFilter, cityFilter, activeTab, activeList]);

  // Load Saved Lists
  useEffect(() => {
    if (activeTab === 'lists' && !activeList) {
      const loadLists = async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE}/lists`);
          const result = await res.json();
          setSavedLists(result || []);
        } catch (err) {
          console.error("Failed to load lists:", err);
        } finally {
          setLoading(false);
        }
      };
      loadLists();
    }
  }, [activeTab, activeList]);

  const handleSaveList = async () => {
    const listName = prompt("Enter a name for this list:");
    if (!listName) return;

    setIsSavingList(true);
    try {
      const filters = {
        search: searchTerm,
        industry: industryFilter,
        country: countryFilter,
        emailType: emailTypeFilter,
        phoneType: phoneTypeFilter,
        emailStatus: emailStatusFilter,
        phoneStatus: phoneStatusFilter,
        company: companyFilter,
        position: positionFilter,
        city: cityFilter
      };

      const res = await fetch(`${API_BASE}/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: listName, filters })
      });
      const result = await res.json();
      
      if (result.success) {
        alert(`Successfully saved ${result.count} contacts to "${listName}".`);
      } else {
        alert(`Failed to save list: ${result.error}`);
      }
    } catch (err) {
      alert(`Error saving list: ${err.message}`);
    } finally {
      setIsSavingList(false);
    }
  };

  const totalPages = Math.ceil(totalRecords / rowsPerPage);

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const renderContactCards = () => (
    <div className="contacts-grid">
      <AnimatePresence>
        {data.map((row, idx) => (
          <motion.div 
            key={row.id || idx}
            className="contact-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: idx * 0.05 }}
          >
            <div className="contact-header">
              <div className="avatar-container">
                {row.person_image_url && row.person_image_url !== 'null' ? (
                  <img 
                    src={row.person_image_url} 
                    alt={row.full_name} 
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                  />
                ) : null}
                <span className="avatar-fallback" style={{ display: (!row.person_image_url || row.person_image_url === 'null') ? 'block' : 'none' }}>
                  {getInitials(row.full_name)}
                </span>
              </div>
              <div className="contact-info-primary">
                <h3>{row.full_name}</h3>
                <p>{row.current_position || 'No Title'}</p>
              </div>
            </div>

            <div className="contact-details">
              <div className="contact-row">
                <Building2 size={14} />
                <span>{row.company_name || '-'}</span>
              </div>
              <div className="contact-row">
                <MapPin size={14} />
                <span>{row.person_city ? `${row.person_city}, ${row.person_country}` : (row.person_country || '-')}</span>
              </div>
              {row[emailSourceFilter] && (
                <div className="contact-row">
                  <Mail size={14} />
                  <span>{row[emailSourceFilter]}</span>
                </div>
              )}
              {row.phone1 && (
                <div className="contact-row">
                  <Phone size={14} />
                  <span>{row.phone1}</span>
                </div>
              )}
            </div>

            <div className="contact-tags">
              {row.person_industry && (
                <span className="tag accent">{row.person_industry}</span>
              )}
              {row[emailSourceFilter + '_type'] && (
                <span className="tag">{row[emailSourceFilter + '_type']} email</span>
              )}
              {row.phone1_type && (
                <span className="tag">{row.phone1_type} phone</span>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="dashboard-container">
      <motion.header 
        className="header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="header-title">
          <div className="stat-icon" style={{ background: 'var(--accent)', color: 'white' }}>
            <Activity size={24} />
          </div>
          <h1>Data Intelligence Hub</h1>
          <button 
            className="btn" 
            onClick={() => { localStorage.removeItem('gld_auth'); setIsAuthenticated(false); }}
            style={{ marginLeft: 'auto', color: 'var(--text-muted)', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
        
        <div className="tabs" style={{ display: 'flex', gap: '1rem', background: 'var(--bg-glass)', padding: '0.5rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
          <button 
            onClick={() => { setActiveTab('dashboard'); setActiveList(null); }}
            style={{ 
              background: activeTab === 'dashboard' ? 'var(--accent-glow)' : 'transparent',
              color: activeTab === 'dashboard' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: activeTab === 'dashboard' ? '1px solid var(--accent)' : '1px solid transparent',
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', fontWeight: 500
            }}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button 
            onClick={() => { setActiveTab('contacts'); setActiveList(null); setPage(1); }}
            style={{ 
              background: activeTab === 'contacts' ? 'var(--accent-glow)' : 'transparent',
              color: activeTab === 'contacts' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: activeTab === 'contacts' ? '1px solid var(--accent)' : '1px solid transparent',
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', fontWeight: 500
            }}
          >
            <Contact size={18} /> Contacts
          </button>
          <button 
            onClick={() => { setActiveTab('lists'); setActiveList(null); setPage(1); }}
            style={{ 
              background: activeTab === 'lists' ? 'var(--accent-glow)' : 'transparent',
              color: activeTab === 'lists' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: activeTab === 'lists' ? '1px solid var(--accent)' : '1px solid transparent',
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', fontWeight: 500
            }}
          >
            <List size={18} /> Saved Lists
          </button>
          <button 
            onClick={() => { setActiveTab('templates'); setActiveList(null); }}
            style={{ 
              background: activeTab === 'templates' ? 'var(--accent-glow)' : 'transparent',
              color: activeTab === 'templates' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: activeTab === 'templates' ? '1px solid var(--accent)' : '1px solid transparent',
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', fontWeight: 500
            }}
          >
            <FileText size={18} /> Templates
          </button>
          <button 
            onClick={() => { setActiveTab('campaigns'); setActiveList(null); }}
            style={{ 
              background: activeTab === 'campaigns' ? 'var(--accent-glow)' : 'transparent',
              color: activeTab === 'campaigns' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: activeTab === 'campaigns' ? '1px solid var(--accent)' : '1px solid transparent',
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', fontWeight: 500
            }}
          >
            <Send size={18} /> Campaigns
          </button>
        </div>
      </motion.header>

      {activeTab === 'dashboard' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="stats-grid" style={{ marginBottom: '2rem' }}>
            <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="stat-header">
                <span>Total Contacts</span>
                <div className="stat-icon"><Users size={20} /></div>
              </div>
              <div className="stat-value">{stats.totalContacts.toLocaleString()}</div>
            </motion.div>
            
            <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="stat-header">
                <span>Unique Companies</span>
                <div className="stat-icon"><Building2 size={20} /></div>
              </div>
              <div className="stat-value">{stats.uniqueCompanies.toLocaleString()}</div>
            </motion.div>

            <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="stat-header">
                <span>Top Industry</span>
                <div className="stat-icon"><Briefcase size={20} /></div>
              </div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                {stats.topIndustries.length > 0 ? stats.topIndustries[0].name : 'N/A'}
              </div>
            </motion.div>
          </div>

          <div className="charts-row">
            <div className="glass-card chart-card">
              <h3>Top Industries</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topIndustries} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card chart-card">
              <h3>Geographic Distribution</h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.topCountries}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.topCountries.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                {stats.topCountries.map((entry, index) => (
                  <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }} />
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'contacts' && (
        <motion.div className="main-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <aside className="glass-card filters-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Filter size={20} color="var(--accent-light)" />
              <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Advanced Filters</h2>
            </div>

            <button 
              className="btn" 
              style={{ width: '100%', marginBottom: '1rem', background: 'var(--accent-glow)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }}
              onClick={handleSaveList}
              disabled={isSavingList || loading || totalRecords === 0}
            >
              {isSavingList ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {isSavingList ? 'Saving...' : `Save ${totalRecords.toLocaleString()} Results to List`}
            </button>

            <div className="filter-group">
              <label className="filter-label">Search Name</label>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="input-styled" 
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="John Doe..." 
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                />
              </div>
            </div>

            <div className="filter-group">
              <label className="filter-label">Company</label>
              <input 
                type="text" 
                className="input-styled" 
                placeholder="Google, Microsoft..." 
                value={companyFilter}
                onChange={e => { setCompanyFilter(e.target.value); setPage(1); }}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Position</label>
              <input 
                type="text" 
                className="input-styled" 
                placeholder="CEO, Manager..." 
                value={positionFilter}
                onChange={e => { setPositionFilter(e.target.value); setPage(1); }}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Email Source</label>
              <select 
                className="input-styled select-styled"
                value={emailSourceFilter}
                onChange={e => { setEmailSourceFilter(e.target.value); setPage(1); }}
              >
                <option value="email1">Email 1 (Primary)</option>
                <option value="email2">Email 2</option>
                <option value="email3">Email 3</option>
                <option value="email4">Email 4</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Email Type</label>
              <select 
                className="input-styled select-styled"
                value={emailTypeFilter}
                onChange={e => { setEmailTypeFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Emails</option>
                <option value="work">Work Email</option>
                <option value="personal">Personal Email</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Phone Type</label>
              <select 
                className="input-styled select-styled"
                value={phoneTypeFilter}
                onChange={e => { setPhoneTypeFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Phones</option>
                {availableFilters.phoneTypes?.map(t => <option key={t} value={t}>{t} phone</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Email Status</label>
              <select 
                className="input-styled select-styled"
                value={emailStatusFilter}
                onChange={e => { setEmailStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Statuses</option>
                {availableFilters.emailStatuses?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Phone Status</label>
              <select 
                className="input-styled select-styled"
                value={phoneStatusFilter}
                onChange={e => { setPhoneStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Statuses</option>
                {availableFilters.phoneStatuses?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Industry</label>
              <input 
                type="text" 
                className="input-styled" 
                placeholder="Software, Finance, Healthcare..." 
                value={industryFilter}
                onChange={e => { setIndustryFilter(e.target.value); setPage(1); }}
              />
            </div>

            <div className="filter-group">
              <label className="filter-label">Country</label>
              <select 
                className="input-styled select-styled"
                value={countryFilter}
                onChange={e => { setCountryFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Countries</option>
                {availableFilters.countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">City</label>
              <input 
                type="text" 
                className="input-styled" 
                placeholder="New York, London..." 
                value={cityFilter}
                onChange={e => { setCityFilter(e.target.value); setPage(1); }}
              />
            </div>
          </aside>

          <div className="data-view">
            {loading ? (
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '550px', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)' }}>
                <Loader2 className="animate-spin" size={40} color="var(--accent)" />
                Fetching data...
              </div>
            ) : data.length > 0 ? (
              renderContactCards()
            ) : (
              <div className="glass-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '550px', color: 'var(--text-muted)' }}>
                No results found. Adjust your filters.
              </div>
            )}
            
            <div className="pagination">
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Showing {Math.min(totalRecords, (page - 1) * rowsPerPage + 1)} to {Math.min(totalRecords, page * rowsPerPage)} of {totalRecords.toLocaleString()} entries
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <button 
                  className="btn" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || totalPages === 0 || loading}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'lists' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {!activeList ? (
            <div className="data-view">
              <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Your Saved Lists</h2>
              
              {loading ? (
                <div className="glass-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)' }}>
                  <Loader2 className="animate-spin" size={40} color="var(--accent)" />
                  Loading lists...
                </div>
              ) : savedLists.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {savedLists.map((list) => (
                    <motion.div 
                      key={list.id}
                      className="glass-card"
                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1rem' }}
                      onClick={() => { setActiveList(list.id); setPage(1); }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="stat-icon" style={{ background: 'var(--accent-glow)' }}>
                          <List size={24} color="var(--accent-light)" />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{list.name}</h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Created on {new Date(list.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          <Users size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                          {list.count.toLocaleString()} Contacts
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button className="btn" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); window.open(`http://localhost:3001/api/lists/${list.id}/export`, '_blank'); }}>
                            <Download size={14} /> CSV
                          </button>
                          <ChevronRight size={16} color="var(--accent)" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="glass-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--text-muted)' }}>
                  You haven't saved any lists yet. Go to Contacts, apply filters, and click "Save Results to List".
                </div>
              )}
            </div>
          ) : (
            <div className="data-view">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <button 
                  className="btn" 
                  onClick={() => { setActiveList(null); setPage(1); }}
                  style={{ padding: '0.5rem' }}
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 style={{ color: 'var(--text-primary)' }}>
                  {savedLists.find(l => l.id === activeList)?.name || 'List View'}
                </h2>
              </div>

              {loading ? (
                <div className="glass-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '550px', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)' }}>
                  <Loader2 className="animate-spin" size={40} color="var(--accent)" />
                  Loading contacts...
                </div>
              ) : data.length > 0 ? (
                renderContactCards()
              ) : (
                <div className="glass-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '550px', color: 'var(--text-muted)' }}>
                  No contacts found in this list.
                </div>
              )}
              
              <div className="pagination" style={{ marginTop: '1.5rem' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Showing {Math.min(totalRecords, (page - 1) * rowsPerPage + 1)} to {Math.min(totalRecords, page * rowsPerPage)} of {totalRecords.toLocaleString()} entries
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <button 
                    className="btn" 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || totalPages === 0 || loading}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'templates' && <TemplatesTab />}

      {activeTab === 'campaigns' && <CampaignsTab />}
    </div>
  );
}

export default App;
