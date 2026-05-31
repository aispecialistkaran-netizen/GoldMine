require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure uploads dir exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: 'uploads/' });

// Gmail transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.gmail_id,
        pass: process.env.gmail_pass
    }
});

console.log(`Email configured for: ${process.env.gmail_id}`);

const dbPath = process.env.DATABASE_PATH || 'database.sqlite';
const db = new sqlite3.Database(dbPath, (err) => {
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
            db.run(`CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                list_id INTEGER,
                media_url TEXT,
                total_messages INTEGER DEFAULT 0,
                sent_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS whatsapp_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_name TEXT NOT NULL,
                campaign_name TEXT NOT NULL,
                media_url TEXT,
                template_params TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`ALTER TABLE campaigns ADD COLUMN target_lists TEXT`, () => {});
            db.run(`ALTER TABLE whatsapp_campaigns ADD COLUMN target_lists TEXT`, () => {});
            db.run(`ALTER TABLE saved_lists ADD COLUMN tags TEXT`, () => {});
            db.run(`ALTER TABLE whatsapp_templates ADD COLUMN template_params TEXT`, () => {});
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

let currentUploadProgress = { status: 'idle', total: 0, inserted: 0, skipped: 0, error: null };

app.get('/api/upload/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const interval = setInterval(() => {
        res.write(`data: ${JSON.stringify(currentUploadProgress)}\n\n`);
        if (currentUploadProgress.status === 'completed' || currentUploadProgress.status === 'error') {
            clearInterval(interval);
            setTimeout(() => res.end(), 1000);
        }
    }, 500);

    req.on('close', () => clearInterval(interval));
});

app.post('/api/upload', upload.array('files'), async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    currentUploadProgress = { status: 'processing', total: 0, inserted: 0, skipped: 0, error: null };
    res.json({ success: true, message: 'Upload started' });

    let cumulativeTotal = 0;
    let cumulativeInserted = 0;
    let cumulativeSkipped = 0;

    for (const file of req.files) {
        try {
            await new Promise(async (resolve, reject) => {
                const filePath = file.path;
                const isExcel = file.originalname.match(/\.xlsx?$/i);

                const stmt = db.prepare(`INSERT OR IGNORE INTO contacts (
                    full_name, email1, email1_type, email1_status, email2, email2_type, email2_status,
                    email3, email3_type, email3_status, email4, email4_type, email4_status,
                    phone1, phone1_type, phone1_status, current_position, company_name, 
                    person_city, person_country, person_industry, person_image_url, person_linkedin_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                db.run("BEGIN TRANSACTION");
                db.run("PRAGMA synchronous = OFF");

                const processRow = (row) => {
                    return new Promise((resolveStmt) => {
                        const linkedin = row.person_linkedin_url || null;
                        stmt.run([
                            row.full_name || null,
                            row.email1 || null, row.email1_type || null, row.email1_status || null,
                            row.email2 || null, row.email2_type || null, row.email2_status || null,
                            row.email3 || null, row.email3_type || null, row.email3_status || null,
                            row.email4 || null, row.email4_type || null, row.email4_status || null,
                            row.phone1 || null, row.phone1_type || null, row.phone1_status || null,
                            row.current_position || null,
                            row.company_name || null,
                            row.person_city || null,
                            row.person_country || null,
                            row.person_industry || null,
                            row.person_image_url || null,
                            linkedin
                        ], function(err) {
                            if (err) console.error(err);
                            else {
                                if (this.changes > 0) cumulativeInserted++;
                                else cumulativeSkipped++;
                            }
                            currentUploadProgress.inserted = cumulativeInserted;
                            currentUploadProgress.skipped = cumulativeSkipped;
                            resolveStmt();
                        });
                    });
                };

                if (isExcel) {
                    try {
                        const workbook = xlsx.readFile(filePath);
                        const sheetName = workbook.SheetNames[0];
                        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
                        
                        for (const row of data) {
                            cumulativeTotal++;
                            currentUploadProgress.total = cumulativeTotal;
                            await processRow(row);
                        }
                        
                        stmt.finalize();
                        db.run("COMMIT", () => {
                            fs.unlinkSync(filePath);
                            resolve();
                        });
                    } catch (err) {
                        db.run("ROLLBACK");
                        fs.unlinkSync(filePath);
                        reject(err);
                    }
                } else {
                    let pending = 0;
                    const stream = fs.createReadStream(filePath).pipe(csv());

                    stream.on('data', (row) => {
                        cumulativeTotal++;
                        currentUploadProgress.total = cumulativeTotal;
                        pending++;

                        processRow(row).then(() => {
                            pending--;
                            if (pending === 0 && stream.isPaused()) stream.resume();
                        });

                        if (pending > 1000) stream.pause();
                    })
                    .on('end', () => {
                        const checkDone = setInterval(() => {
                            if (pending === 0) {
                                clearInterval(checkDone);
                                stmt.finalize();
                                db.run("COMMIT", () => {
                                    fs.unlinkSync(filePath);
                                    resolve();
                                });
                            }
                        }, 100);
                    })
                    .on('error', (err) => {
                        db.run("ROLLBACK");
                        fs.unlinkSync(filePath);
                        reject(err);
                    });
                }
            });
        } catch (err) {
            console.error('File processing error:', err);
            currentUploadProgress.status = 'error';
            currentUploadProgress.error = err.message;
            return; // Stop processing further files
        }
    }

    if (currentUploadProgress.status !== 'error') {
        currentUploadProgress.status = 'completed';
        currentUploadProgress.inserted = cumulativeInserted;
        currentUploadProgress.skipped = cumulativeSkipped;
        currentUploadProgress.total = cumulativeTotal;
    }
});

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

        if (search) {
            const searchConds = ['full_name LIKE ?', 'company_name LIKE ?', 'email1 LIKE ?', 'email2 LIKE ?', 'email3 LIKE ?', 'email4 LIKE ?'];
            const searchParams = [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`];
            const digitsOnly = search.replace(/\D/g, '');
            if (digitsOnly.length > 0) {
                searchConds.push("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone1, ' ', ''), '+', ''), '-', ''), '(', ''), ')', '') LIKE ?");
                searchParams.push(`%${digitsOnly}%`);
            }
            baseQuery += ` AND (${searchConds.join(' OR ')})`;
            params.push(...searchParams);
        }
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
        const { name, tags, filters } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        db.run('INSERT INTO saved_lists (name, tags) VALUES (?, ?)', [name, tags || ''], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const listId = this.lastID;

            let baseQuery = 'FROM contacts WHERE 1=1';
            const params = [];

            if (filters.search) {
                const searchConds = ['full_name LIKE ?', 'company_name LIKE ?', 'email1 LIKE ?', 'email2 LIKE ?', 'email3 LIKE ?', 'email4 LIKE ?'];
                const searchParams = [`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`];
                const digitsOnly = filters.search.replace(/\D/g, '');
                if (digitsOnly.length > 0) {
                    searchConds.push("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone1, ' ', ''), '+', ''), '-', ''), '(', ''), ')', '') LIKE ?");
                    searchParams.push(`%${digitsOnly}%`);
                }
                baseQuery += ` AND (${searchConds.join(' OR ')})`;
                params.push(...searchParams);
            }
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
            SELECT sl.id, sl.name, sl.tags, sl.created_at, COUNT(lm.contact_id) as count 
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

app.put('/api/lists/:id', async (req, res) => {
    try {
        const { name, tags } = req.body;
        const updates = [];
        const params = [];
        
        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (tags !== undefined) {
            updates.push('tags = ?');
            params.push(tags);
        }
        
        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
        
        params.push(req.params.id);
        await runQuery(`UPDATE saved_lists SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/lists/:id', async (req, res) => {
    try {
        await runQuery('DELETE FROM saved_lists WHERE id = ?', [req.params.id]);
        await runQuery('DELETE FROM list_members WHERE list_id = ?', [req.params.id]);
        res.json({ success: true });
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

// Preview recipient count before sending
app.post('/api/campaigns/preview', async (req, res) => {
    try {
        const { list_ids, email_field, email_type_filter, email_status_filter } = req.body;
        if (!list_ids || list_ids.length === 0) return res.json({ count: 0 });

        const placeholders = list_ids.map(() => '?').join(',');
        let query = `SELECT COUNT(DISTINCT c.id) as count FROM contacts c JOIN list_members lm ON c.id = lm.contact_id WHERE lm.list_id IN (${placeholders})`;
        const params = [...list_ids];

        let emailColumn = 'email1';
        if (['email1', 'email2', 'email3', 'email4'].includes(email_field)) {
            emailColumn = email_field;
        }

        query += ` AND c.${emailColumn} IS NOT NULL AND c.${emailColumn} != ''`;

        if (email_type_filter === 'work') {
            query += ` AND c.${emailColumn}_type IN ('company', 'job', 'main job')`;
        } else if (email_type_filter === 'personal') {
            query += ` AND c.${emailColumn}_type = 'personal'`;
        }

        if (email_status_filter) {
            query += ` AND c.${emailColumn}_status = ?`;
            params.push(email_status_filter);
        }

        const result = await getOne(query, params);
        res.json({ count: result.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// In-memory abort flags for running campaigns
const activeCampaigns = new Map();

app.post('/api/campaigns/:id/stop', async (req, res) => {
    const campaignId = parseInt(req.params.id);
    if (activeCampaigns.has(campaignId)) {
        activeCampaigns.set(campaignId, 'abort');
        res.json({ success: true, message: 'Campaign stop signal sent' });
    } else {
        // Campaign may have already finished, just mark it stopped in DB
        await runQuery('UPDATE campaigns SET status = ? WHERE id = ? AND status = ?', ['stopped', campaignId, 'sending']);
        res.json({ success: true, message: 'Campaign marked as stopped' });
    }
});

app.post('/api/campaigns/send', async (req, res) => {
    try {
        const { template_id, list_ids, email_field, email_type_filter, email_status_filter } = req.body;

        const template = await getOne('SELECT * FROM templates WHERE id = ?', [template_id]);
        if (!template) return res.status(400).json({ error: 'Template not found' });
        if (!list_ids || list_ids.length === 0) return res.status(400).json({ error: 'Select at least one list' });

        // Get contacts from all selected lists, deduplicated by email
        const placeholders = list_ids.map(() => '?').join(',');
        let query = `SELECT DISTINCT c.* FROM contacts c JOIN list_members lm ON c.id = lm.contact_id WHERE lm.list_id IN (${placeholders})`;
        const params = [...list_ids];

        let emailColumn = 'email1';
        if (['email1', 'email2', 'email3', 'email4'].includes(email_field)) {
            emailColumn = email_field;
        }

        query += ` AND c.${emailColumn} IS NOT NULL AND c.${emailColumn} != ''`;

        if (email_type_filter === 'work') {
            query += ` AND c.${emailColumn}_type IN ('company', 'job', 'main job')`;
        } else if (email_type_filter === 'personal') {
            query += ` AND c.${emailColumn}_type = 'personal'`;
        }

        if (email_status_filter) {
            query += ` AND c.${emailColumn}_status = ?`;
            params.push(email_status_filter);
        }

        const contacts = await getAll(query, params);

        if (contacts.length === 0) {
            return res.status(400).json({ error: 'No contacts found with the selected criteria' });
        }

        // Get list names for campaign label
        const listNames = await getAll(`SELECT name FROM saved_lists WHERE id IN (${placeholders})`, list_ids);
        const campaignName = `${template.subject} → ${listNames.map(l => l.name).join(', ')}`;
        const targetListsStr = listNames.map(l => l.name).join(', ');

        const result = await runQuery(
            'INSERT INTO campaigns (name, template_id, list_id, email_field, email_status_filter, total_emails, status, target_lists) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [campaignName, template_id, list_ids[0], email_field, email_status_filter || '', contacts.length, 'sending', targetListsStr]
        );
        const campaignId = result.lastID;

        // Register this campaign as active
        activeCampaigns.set(campaignId, 'running');

        res.json({ success: true, campaignId, totalEmails: contacts.length });

        // Send emails in background
        let sent = 0;
        let failed = 0;

        for (const contact of contacts) {
            // Check if campaign was aborted
            if (activeCampaigns.get(campaignId) === 'abort') {
                console.log(`Campaign ${campaignId} stopped by user after ${sent} sent, ${failed} failed`);
                await runQuery(
                    'UPDATE campaigns SET status = ?, sent_count = ?, failed_count = ? WHERE id = ?',
                    ['stopped', sent, failed, campaignId]
                );
                activeCampaigns.delete(campaignId);
                return;
            }

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

                const targetEmail = contact[emailColumn];
                await transporter.sendMail({
                    from: `"${template.sender_name}" <${process.env.gmail_id}>`,
                    to: targetEmail,
                    subject: personalizedSubject,
                    html: personalizedBody
                });
                sent++;
            } catch (err) {
                console.error(`Failed to send to ${contact[emailColumn]}:`, err.message);
                failed++;
            }

            await runQuery(
                'UPDATE campaigns SET sent_count = ?, failed_count = ? WHERE id = ?',
                [sent, failed, campaignId]
            );

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        activeCampaigns.delete(campaignId);

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

// ======================== WHATSAPP TEMPLATES ========================
app.get('/api/whatsapp/templates', async (req, res) => {
    try {
        const templates = await getAll('SELECT * FROM whatsapp_templates ORDER BY created_at DESC');
        res.json(templates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/whatsapp/templates', async (req, res) => {
    try {
        const { template_name, campaign_name, media_url, template_params } = req.body;
        if (!template_name || !campaign_name) {
            return res.status(400).json({ error: 'Template name and campaign name are required' });
        }
        const result = await runQuery(
            'INSERT INTO whatsapp_templates (template_name, campaign_name, media_url, template_params) VALUES (?, ?, ?, ?)',
            [template_name, campaign_name, media_url || '', template_params || '']
        );
        res.json({ success: true, id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/whatsapp/templates/:id', async (req, res) => {
    try {
        await runQuery('DELETE FROM whatsapp_templates WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================== WHATSAPP CAMPAIGNS ========================
app.get('/api/whatsapp/campaigns', async (req, res) => {
    try {
        const campaigns = await getAll(`
            SELECT c.*, sl.name as list_name
            FROM whatsapp_campaigns c
            LEFT JOIN saved_lists sl ON c.list_id = sl.id
            ORDER BY c.created_at DESC
        `);
        res.json(campaigns);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/whatsapp/campaigns/:id/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const campaignId = req.params.id;
    const interval = setInterval(async () => {
        try {
            const campaign = await getOne('SELECT * FROM whatsapp_campaigns WHERE id = ?', [campaignId]);
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

app.post('/api/whatsapp/send', async (req, res) => {
    try {
        const { campaignName, list_ids, mediaUrl, templateParams } = req.body;

        if (!process.env.aisensy_api) return res.status(400).json({ error: 'aisensy_api not configured in .env' });
        if (!campaignName) return res.status(400).json({ error: 'Campaign name is required' });
        if (!list_ids || list_ids.length === 0) return res.status(400).json({ error: 'Select at least one list' });

        // Retrieve template_params and media_url configuration
        let templateParamsConfig = templateParams;
        let finalMediaUrl = mediaUrl;
        if (templateParamsConfig === undefined || finalMediaUrl === undefined) {
            const templateObj = await getOne('SELECT template_params, media_url FROM whatsapp_templates WHERE campaign_name = ?', [campaignName]);
            if (templateObj) {
                if (templateParamsConfig === undefined && templateObj.template_params !== null && templateObj.template_params !== undefined) {
                    templateParamsConfig = templateObj.template_params;
                }
                if (finalMediaUrl === undefined && templateObj.media_url !== null && templateObj.media_url !== undefined) {
                    finalMediaUrl = templateObj.media_url;
                }
            }
        }
        if (templateParamsConfig === undefined) {
            templateParamsConfig = 'full_name'; // Default backward compatibility
        }
        if (finalMediaUrl === undefined) {
            finalMediaUrl = '';
        }

        // Parse config to array
        let paramsList = Array.isArray(templateParamsConfig)
            ? templateParamsConfig
            : (typeof templateParamsConfig === 'string'
                ? templateParamsConfig.split(',').map(s => s.trim()).filter(Boolean)
                : []);

        const placeholders = list_ids.map(() => '?').join(',');
        let query = `SELECT DISTINCT c.* FROM contacts c JOIN list_members lm ON c.id = lm.contact_id WHERE lm.list_id IN (${placeholders})`;
        const params = [...list_ids];

        query += ` AND c.full_name IS NOT NULL AND c.full_name != '' AND c.phone1 IS NOT NULL AND c.phone1 != '' AND c.phone1_type = 'personal'`;

        const contacts = await getAll(query, params);

        if (contacts.length === 0) {
            return res.status(400).json({ error: 'No contacts found with a name and phone number' });
        }

        const listNames = await getAll(`SELECT name FROM saved_lists WHERE id IN (${placeholders})`, list_ids);
        const targetListsStr = listNames.map(l => l.name).join(', ');

        const result = await runQuery(
            'INSERT INTO whatsapp_campaigns (name, list_id, media_url, total_messages, status, target_lists) VALUES (?, ?, ?, ?, ?, ?)',
            [campaignName, list_ids[0], finalMediaUrl || '', contacts.length, 'sending', targetListsStr]
        );
        const campaignId = result.lastID;

        res.json({ success: true, campaignId, totalMessages: contacts.length });

        let sent = 0;
        let failed = 0;

        for (const contact of contacts) {
            try {
                let phone = contact.phone1.replace(/\D/g, '');
                if (phone.length === 10) phone = '91' + phone;

                const resolvedParams = paramsList.map(param => {
                    const normalized = param.trim().toLowerCase();
                    if (normalized === 'full_name' || normalized === 'fullname' || normalized === 'name') return contact.full_name || '';
                    if (normalized === 'company_name' || normalized === 'company') return contact.company_name || '';
                    if (normalized === 'current_position' || normalized === 'position' || normalized === 'designation') return contact.current_position || '';
                    if (normalized === 'person_city' || normalized === 'city') return contact.person_city || '';
                    if (normalized === 'person_country' || normalized === 'country') return contact.person_country || '';
                    if (normalized === 'person_industry' || normalized === 'industry') return contact.person_industry || '';
                    if (normalized === 'email' || normalized === 'email1') return contact.email1 || '';
                    if (normalized === 'phone' || normalized === 'phone1') return contact.phone1 || '';
                    if (contact[param] !== undefined) return contact[param] || '';
                    return '';
                });

                const payload = {
                    apiKey: process.env.aisensy_api,
                    campaignName: campaignName,
                    destination: phone,
                    userName: contact.full_name,
                    templateParams: resolvedParams,
                    source: "Data Intelligence Hub",
                    buttons: [],
                    carouselCards: [],
                    location: {},
                    attributes: {
                        "Designation": contact.current_position || "",
                        "LinkedIn": contact.person_linkedin_url || "", 
                        "Email": contact.email1 || "",
                        "Company": contact.company_name || ""
                    },
                    paramsFallbackValue: {
                        FirstName: "user"
                    }
                };

                if (finalMediaUrl) {
                    payload.media = {
                        url: finalMediaUrl,
                        filename: "media_file"
                    };
                }

                const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    sent++;
                } else {
                    const data = await response.json().catch(() => ({}));
                    console.error(`Failed to send to ${phone}:`, data);
                    failed++;
                }
            } catch (err) {
                console.error(`Failed to send to ${contact.phone1}:`, err.message);
                failed++;
            }

            await runQuery(
                'UPDATE whatsapp_campaigns SET sent_count = ?, failed_count = ? WHERE id = ?',
                [sent, failed, campaignId]
            );

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        await runQuery(
            'UPDATE whatsapp_campaigns SET status = ?, sent_count = ?, failed_count = ? WHERE id = ?',
            ['completed', sent, failed, campaignId]
        );
        console.log(`WhatsApp Campaign ${campaignId} completed: ${sent} sent, ${failed} failed`);

    } catch (err) {
        console.error('WhatsApp Campaign error:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});
