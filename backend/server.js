require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Gmail transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.gmail_id,
        pass: process.env.gmail_pass
    }
});

console.log(`Email configured for: ${process.env.gmail_id}`);

const db = new sqlite3.Database('database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS saved_lists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS list_members (
                list_id INTEGER,
                contact_id INTEGER,
                PRIMARY KEY (list_id, contact_id)
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_name TEXT NOT NULL,
                subject TEXT NOT NULL,
                html_body TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                template_id INTEGER,
                list_id INTEGER,
                email_field TEXT DEFAULT 'company',
                email_status_filter TEXT DEFAULT '',
                total_emails INTEGER DEFAULT 0,
                sent_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });
    }
});

const getAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const getOne = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

// ======================== STATS ========================
app.get('/api/stats', async (req, res) => {
    try {
        const totalContacts = await getOne('SELECT COUNT(*) as count FROM contacts');
        const uniqueCompanies = await getOne('SELECT COUNT(DISTINCT company_name) as count FROM contacts WHERE company_name IS NOT NULL AND company_name != ""');
        
        const topIndustries = await getAll('SELECT person_industry as name, COUNT(*) as value FROM contacts WHERE person_industry IS NOT NULL AND person_industry != "" GROUP BY person_industry ORDER BY value DESC LIMIT 5');
        const topCountries = await getAll('SELECT person_country as name, COUNT(*) as value FROM contacts WHERE person_country IS NOT NULL AND person_country != "" GROUP BY person_country ORDER BY value DESC LIMIT 5');

        res.json({
            totalContacts: totalContacts.count,
            uniqueCompanies: uniqueCompanies.count,
            topIndustries,
            topCountries
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================== FILTERS ========================
app.get('/api/filters', async (req, res) => {
    try {
        const industries = await getAll('SELECT DISTINCT person_industry as name FROM contacts WHERE person_industry IS NOT NULL AND person_industry != "" ORDER BY name');
        const countries = await getAll('SELECT DISTINCT person_country as name FROM contacts WHERE person_country IS NOT NULL AND person_country != "" ORDER BY name');
        const emailStatuses = await getAll('SELECT DISTINCT email1_status as name FROM contacts WHERE email1_status IS NOT NULL AND email1_status != "" ORDER BY name');
        const phoneStatuses = await getAll('SELECT DISTINCT phone1_status as name FROM contacts WHERE phone1_status IS NOT NULL AND phone1_status != "" ORDER BY name');
        const phoneTypes = await getAll('SELECT DISTINCT phone1_type as name FROM contacts WHERE phone1_type IS NOT NULL AND phone1_type != "" ORDER BY name');
        
        res.json({
            industries: industries.map(i => i.name),
            countries: countries.map(c => c.name),
            emailStatuses: emailStatuses.map(e => e.name),
            phoneStatuses: phoneStatuses.map(p => p.name),
            phoneTypes: phoneTypes.map(p => p.name)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================== CONTACTS ========================
app.get('/api/contacts', async (req, res) => {
    try {
        const { page = 1, limit = 15, search = '', industry = '', country = '', emailType = '', phoneType = '', emailStatus = '', phoneStatus = '', company = '', position = '', city = '', emailSource = '' } = req.query;
        const offset = (page - 1) * limit;

        let baseQuery = 'FROM contacts WHERE 1=1';
        const params = [];

        if (search) { baseQuery += ' AND (full_name LIKE ? OR company_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        if (industry) { baseQuery += ' AND person_industry LIKE ?'; params.push(`%${industry}%`); }
        if (country) { baseQuery += ' AND person_country = ?'; params.push(country); }
        
        // Email source + type + status filtering
        const eCol = emailSource || 'email1';
        const eTypeCol = eCol + '_type';
        const eStatusCol = eCol + '_status';
        
        if (emailType === 'work') { 
            baseQuery += ` AND ${eTypeCol} IN ('company', 'job', 'main job')`; 
        } else if (emailType === 'personal') { 
            baseQuery += ` AND ${eTypeCol} = 'personal'`; 
        }
        if (emailStatus) { baseQuery += ` AND ${eStatusCol} = ?`; params.push(emailStatus); }
        
        if (phoneType) { baseQuery += ' AND phone1_type = ?'; params.push(phoneType); }
        if (phoneStatus) { baseQuery += ' AND phone1_status = ?'; params.push(phoneStatus); }
        if (company) { baseQuery += ' AND company_name LIKE ?'; params.push(`%${company}%`); }
        if (position) { baseQuery += ' AND current_position LIKE ?'; params.push(`%${position}%`); }
        if (city) { baseQuery += ' AND person_city LIKE ?'; params.push(`%${city}%`); }

        const countQuery = `SELECT COUNT(*) as count ${baseQuery}`;
        const dataQuery = `SELECT * ${baseQuery} LIMIT ? OFFSET ?`;

        const totalRow = await getOne(countQuery, params);
        const data = await getAll(dataQuery, [...params, limit, offset]);

        res.json({ total: totalRow.count, page: parseInt(page), limit: parseInt(limit), data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================== LISTS ========================
app.post('/api/lists', async (req, res) => {
    try {
        const { name, filters } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        db.run('INSERT INTO saved_lists (name) VALUES (?)', [name], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const listId = this.lastID;

            let baseQuery = 'FROM contacts WHERE 1=1';
            const params = [];

            if (filters.search) { baseQuery += ' AND (full_name LIKE ? OR company_name LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`); }
            if (filters.industry) { baseQuery += ' AND person_industry LIKE ?'; params.push(`%${filters.industry}%`); }
            if (filters.country) { baseQuery += ' AND person_country = ?'; params.push(filters.country); }
            if (filters.emailType) { baseQuery += ' AND email1_type = ?'; params.push(filters.emailType); }
            if (filters.phoneType) { baseQuery += ' AND phone1_type = ?'; params.push(filters.phoneType); }
            if (filters.emailStatus) { baseQuery += ' AND email1_status = ?'; params.push(filters.emailStatus); }
            if (filters.phoneStatus) { baseQuery += ' AND phone1_status = ?'; params.push(filters.phoneStatus); }
            if (filters.company) { baseQuery += ' AND company_name LIKE ?'; params.push(`%${filters.company}%`); }
            if (filters.position) { baseQuery += ' AND current_position LIKE ?'; params.push(`%${filters.position}%`); }
            if (filters.city) { baseQuery += ' AND person_city LIKE ?'; params.push(`%${filters.city}%`); }

            db.all(`SELECT id ${baseQuery}`, params, (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                if (rows.length === 0) return res.json({ success: true, listId, count: 0 });

                const stmt = db.prepare('INSERT INTO list_members (list_id, contact_id) VALUES (?, ?)');
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    rows.forEach(r => stmt.run([listId, r.id]));
                    db.run('COMMIT', () => {
                        stmt.finalize();
                        res.json({ success: true, listId, count: rows.length });
                    });
                });
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/lists', async (req, res) => {
    try {
        const query = `
            SELECT sl.id, sl.name, sl.created_at, COUNT(lm.contact_id) as count 
            FROM saved_lists sl 
            LEFT JOIN list_members lm ON sl.id = lm.list_id 
            GROUP BY sl.id 
            ORDER BY sl.created_at DESC
        `;
        const lists = await getAll(query);
        res.json(lists);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/lists/:id/contacts', async (req, res) => {
    try {
        const listId = req.params.id;
        const { page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;

        const baseQuery = 'FROM contacts c JOIN list_members lm ON c.id = lm.contact_id WHERE lm.list_id = ?';
        const countQuery = `SELECT COUNT(*) as count ${baseQuery}`;
        const dataQuery = `SELECT c.* ${baseQuery} LIMIT ? OFFSET ?`;

        const totalRow = await getOne(countQuery, [listId]);
        const data = await getAll(dataQuery, [listId, limit, offset]);

        res.json({ total: totalRow.count, page: parseInt(page), limit: parseInt(limit), data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/lists/:id/export', async (req, res) => {
    try {
        const listId = req.params.id;
        const list = await getOne('SELECT name FROM saved_lists WHERE id = ?', [listId]);
        const data = await getAll(
            'SELECT c.full_name, c.email1, c.email1_type, c.email1_status, c.phone1, c.phone1_type, c.phone1_status, c.current_position, c.company_name, c.person_city, c.person_country, c.person_industry FROM contacts c JOIN list_members lm ON c.id = lm.contact_id WHERE lm.list_id = ?',
            [listId]
        );

        const headers = ['Full Name','Email','Email Type','Email Status','Phone','Phone Type','Phone Status','Position','Company','City','Country','Industry'];
        const escapeCSV = (val) => {
            if (!val) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) return '"' + str.replace(/"/g, '""') + '"';
            return str;
        };
        const rows = data.map(r => [
            r.full_name, r.email1, r.email1_type, r.email1_status, r.phone1, r.phone1_type, r.phone1_status,
            r.current_position, r.company_name, r.person_city, r.person_country, r.person_industry
        ].map(escapeCSV).join(','));

        const csv = [headers.join(','), ...rows].join('\n');
        const filename = (list?.name || 'list').replace(/[^a-zA-Z0-9]/g, '_');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================== TEMPLATES ========================
app.get('/api/templates', async (req, res) => {
    try {
        const templates = await getAll('SELECT * FROM templates ORDER BY created_at DESC');
        res.json(templates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/templates', async (req, res) => {
    try {
        const { sender_name, subject, html_body } = req.body;
        if (!sender_name || !subject || !html_body) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        const result = await runQuery(
            'INSERT INTO templates (sender_name, subject, html_body) VALUES (?, ?, ?)',
            [sender_name, subject, html_body]
        );
        res.json({ success: true, id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/templates/:id', async (req, res) => {
    try {
        const { sender_name, subject, html_body } = req.body;
        if (!sender_name || !subject || !html_body) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        await runQuery(
            'UPDATE templates SET sender_name = ?, subject = ?, html_body = ? WHERE id = ?',
            [sender_name, subject, html_body, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/templates/:id', async (req, res) => {
    try {
        await runQuery('DELETE FROM templates WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================== CAMPAIGNS ========================
app.get('/api/campaigns', async (req, res) => {
    try {
        const campaigns = await getAll(`
            SELECT c.*, t.subject as template_subject, t.sender_name, sl.name as list_name
            FROM campaigns c
            LEFT JOIN templates t ON c.template_id = t.id
            LEFT JOIN saved_lists sl ON c.list_id = sl.id
            ORDER BY c.created_at DESC
        `);
        res.json(campaigns);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/campaigns/:id', async (req, res) => {
    try {
        const campaign = await getOne(`
            SELECT c.*, t.subject as template_subject, t.sender_name, sl.name as list_name
            FROM campaigns c
            LEFT JOIN templates t ON c.template_id = t.id
            LEFT JOIN saved_lists sl ON c.list_id = sl.id
            WHERE c.id = ?
        `, [req.params.id]);
        res.json(campaign);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SSE endpoint for campaign progress
app.get('/api/campaigns/:id/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const campaignId = req.params.id;
    const interval = setInterval(async () => {
        try {
            const campaign = await getOne('SELECT * FROM campaigns WHERE id = ?', [campaignId]);
            if (!campaign) {
                clearInterval(interval);
                res.end();
                return;
            }
            res.write(`data: ${JSON.stringify(campaign)}\n\n`);
            if (campaign.status === 'completed' || campaign.status === 'failed') {
                clearInterval(interval);
                setTimeout(() => res.end(), 1000);
            }
        } catch (err) {
            clearInterval(interval);
            res.end();
        }
    }, 500);

    req.on('close', () => clearInterval(interval));
});

app.post('/api/campaigns/send', async (req, res) => {
    try {
        const { template_id, list_ids, email_field, email_status_filter } = req.body;

        const template = await getOne('SELECT * FROM templates WHERE id = ?', [template_id]);
        if (!template) return res.status(400).json({ error: 'Template not found' });
        if (!list_ids || list_ids.length === 0) return res.status(400).json({ error: 'Select at least one list' });

        // Get contacts from all selected lists, deduplicated by email
        const placeholders = list_ids.map(() => '?').join(',');
        let query = `SELECT DISTINCT c.* FROM contacts c JOIN list_members lm ON c.id = lm.contact_id WHERE lm.list_id IN (${placeholders})`;
        const params = [...list_ids];

        if (email_field === 'personal') {
            query += ` AND c.email1_type = 'personal' AND c.email1 IS NOT NULL AND c.email1 != ''`;
        } else {
            query += ` AND c.email1_type IN ('company', 'job', 'main job') AND c.email1 IS NOT NULL AND c.email1 != ''`;
        }

        if (email_status_filter) {
            query += ` AND c.email1_status = ?`;
            params.push(email_status_filter);
        }

        const contacts = await getAll(query, params);

        if (contacts.length === 0) {
            return res.status(400).json({ error: 'No contacts found with the selected criteria' });
        }

        // Get list names for campaign label
        const listNames = await getAll(`SELECT name FROM saved_lists WHERE id IN (${placeholders})`, list_ids);
        const campaignName = `${template.subject} → ${listNames.map(l => l.name).join(', ')}`;

        const result = await runQuery(
            'INSERT INTO campaigns (name, template_id, list_id, email_field, email_status_filter, total_emails, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [campaignName, template_id, list_ids[0], email_field, email_status_filter || '', contacts.length, 'sending']
        );
        const campaignId = result.lastID;

        res.json({ success: true, campaignId, totalEmails: contacts.length });

        // Send emails in background
        let sent = 0;
        let failed = 0;

        for (const contact of contacts) {
            try {
                let personalizedSubject = template.subject
                    .replace(/{{name}}/gi, contact.full_name || '')
                    .replace(/{{company}}/gi, contact.company_name || '')
                    .replace(/{{position}}/gi, contact.current_position || '');

                let personalizedBody = template.html_body
                    .replace(/{{name}}/gi, contact.full_name || '')
                    .replace(/{{company}}/gi, contact.company_name || '')
                    .replace(/{{position}}/gi, contact.current_position || '')
                    .replace(/{{city}}/gi, contact.person_city || '')
                    .replace(/{{country}}/gi, contact.person_country || '')
                    .replace(/{{industry}}/gi, contact.person_industry || '');

                await transporter.sendMail({
                    from: `"${template.sender_name}" <${process.env.gmail_id}>`,
                    to: contact.email1,
                    subject: personalizedSubject,
                    html: personalizedBody
                });
                sent++;
            } catch (err) {
                console.error(`Failed to send to ${contact.email1}:`, err.message);
                failed++;
            }

            await runQuery(
                'UPDATE campaigns SET sent_count = ?, failed_count = ? WHERE id = ?',
                [sent, failed, campaignId]
            );

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        await runQuery(
            'UPDATE campaigns SET status = ?, sent_count = ?, failed_count = ? WHERE id = ?',
            ['completed', sent, failed, campaignId]
        );
        console.log(`Campaign ${campaignId} completed: ${sent} sent, ${failed} failed`);

    } catch (err) {
        console.error('Campaign error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});
