# GLD Mine (Data Intelligence Hub) Project Reference

This reference file provides a comprehensive overview of the **GLD Mine (Data Intelligence Hub)** application architecture, tech stack, database schemas, APIs, and configuration details.

---

## 📂 Project Structure

```
GLD Mine/
├── backend/
│   ├── database.sqlite       # SQLite database file storing application data
│   ├── init_db.js            # Initial database setup and CSV import script
│   ├── server.js             # Express API server handling business logic
│   ├── uploads/              # Temporary folder for file uploads
│   ├── package.json          # Backend dependencies and scripts
│   └── package-lock.json
├── webapp/
│   ├── src/
│   │   ├── assets/           # Static assets
│   │   ├── data/
│   │   │   └── sample_data.json  # Extracted sample contacts (used for local testing)
│   │   ├── App.css           # Component-specific styles
│   │   ├── App.jsx           # Main webapp shell, router, dashboard & contacts view
│   │   ├── CampaignsTab.jsx  # Email campaigns creation, history, and monitoring tab
│   │   ├── LoginPage.jsx     # Authentication gateway
│   │   ├── TemplatesTab.jsx  # Email templates manager tab
│   │   ├── UploaderTab.jsx   # Bulk CSV/Excel importer tab with progress reporting
│   │   ├── WhatsappTab.jsx   # WhatsApp campaigns and templates tab
│   │   ├── index.css         # Global design tokens and styles (Glassmorphism theme)
│   │   └── main.jsx          # Vite React entrypoint
│   ├── eslint.config.js
│   ├── extract_sample.cjs    # Utility script to extract sample json from raw CSV
│   ├── index.html
│   ├── package.json          # Frontend dependencies and dev scripts
│   └── vite.config.js
├── .env                      # Global environment configurations and secret keys
├── .gitignore
└── merged_output.csv         # Raw CSV contact dump
```

---

## 🛠️ Technology Stack

### Backend
*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Database**: SQLite (`sqlite3` module) for light and fast relational storage
*   **Mailer Service**: Nodemailer (configured with Gmail SMTP)
*   **File Uploads**: Multer
*   **Parsing Utilities**: `csv-parser` and `xlsx` (Excel sheets parser)
*   **External Integration**: Fetch API for sending campaigns to **AiSensy** (WhatsApp provider)

### Frontend
*   **Core**: React (Vite build system)
*   **Design/Styles**: Vanilla CSS utilizing modern CSS variables for glassmorphism, flexbox, and grid layouts.
*   **Animations**: Framer Motion for premium micro-animations, transitions, and tab switching.
*   **Icons**: Lucide React
*   **Visualizations/Charts**: Recharts (Pie & Bar charts for telemetry/demographics data)
*   **CSV Parsing**: PapaParse

---

## 🗄️ Database Schemas (SQLite)

The database schema is initialized in `backend/init_db.js` and altered/maintained on server start in `backend/server.js`.

### 1. `contacts`
Stores all imported contacts. The unique constraint/deduplication identifier is `person_linkedin_url`.
*   `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
*   `full_name`: `TEXT`
*   `email1` / `email2` / `email3` / `email4`: `TEXT`
*   `email1_type` / `email2_type` / `email3_type` / `email4_type`: `TEXT` (e.g. `work`, `personal`)
*   `email1_status` / `email2_status` / `email3_status` / `email4_status`: `TEXT` (e.g. `deliverable`, `undeliverable`)
*   `phone1`: `TEXT`
*   `phone1_type`: `TEXT` (e.g. `personal`, `work`)
*   `phone1_status`: `TEXT`
*   `current_position`: `TEXT`
*   `company_name`: `TEXT`
*   `person_city`: `TEXT`
*   `person_country`: `TEXT`
*   `person_industry`: `TEXT`
*   `person_image_url`: `TEXT`
*   `person_linkedin_url`: `TEXT`
*   **Indexes**:
    *   `idx_name` on `contacts(full_name)`
    *   `idx_company` on `contacts(company_name)`
    *   `idx_industry` on `contacts(person_industry)`
    *   `idx_country` on `contacts(person_country)`

### 2. `saved_lists`
User-defined filtered groups of contacts.
*   `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
*   `name`: `TEXT NOT NULL`
*   `tags`: `TEXT` (Comma-separated labels)
*   `created_at`: `DATETIME DEFAULT CURRENT_TIMESTAMP`

### 3. `list_members`
A join table facilitating a many-to-many relationship between lists and contacts.
*   `list_id`: `INTEGER`
*   `contact_id`: `INTEGER`
*   `PRIMARY KEY (list_id, contact_id)`

### 4. `templates`
HTML Email templates for outreach campaigns.
*   `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
*   `sender_name`: `TEXT NOT NULL`
*   `subject`: `TEXT NOT NULL`
*   `html_body`: `TEXT NOT NULL`
*   `created_at`: `DATETIME DEFAULT CURRENT_TIMESTAMP`

### 5. `campaigns`
Tracks active and completed email outreach sequences.
*   `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
*   `name`: `TEXT`
*   `template_id`: `INTEGER`
*   `list_id`: `INTEGER`
*   `email_field`: `TEXT DEFAULT 'company'`
*   `email_status_filter`: `TEXT DEFAULT ''`
*   `total_emails`: `INTEGER DEFAULT 0`
*   `sent_count`: `INTEGER DEFAULT 0`
*   `failed_count`: `INTEGER DEFAULT 0`
*   `status`: `TEXT DEFAULT 'pending'` (e.g., `sending`, `completed`, `failed`, `stopped`)
*   `target_lists`: `TEXT`
*   `created_at`: `DATETIME DEFAULT CURRENT_TIMESTAMP`

### 6. `whatsapp_templates`
Saves template mappings for the AiSensy API integration.
*   `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
*   `template_name`: `TEXT NOT NULL` (Internal reference)
*   `campaign_name`: `TEXT NOT NULL` (Matches template name registered on AiSensy)
*   `media_url`: `TEXT` (Optional attachment url)
*   `template_params`: `TEXT` (Comma-separated customization parameters, e.g. `'full_name'`, empty for 0 params)
*   `created_at`: `DATETIME DEFAULT CURRENT_TIMESTAMP`

### 7. `whatsapp_campaigns`
Tracks active and historical WhatsApp broadcasts.
*   `id`: `INTEGER PRIMARY KEY AUTOINCREMENT`
*   `name`: `TEXT`
*   `list_id`: `INTEGER`
*   `media_url`: `TEXT`
*   `total_messages`: `INTEGER DEFAULT 0`
*   `sent_count`: `INTEGER DEFAULT 0`
*   `failed_count`: `INTEGER DEFAULT 0`
*   `status`: `TEXT DEFAULT 'pending'` (e.g., `sending`, `completed`, `failed`)
*   `target_lists`: `TEXT`
*   `created_at`: `DATETIME DEFAULT CURRENT_TIMESTAMP`

---

## 📡 API Endpoints Reference

### 🚀 Contact Import & Processing
*   `POST /api/upload`: Multi-file form data upload endpoint. Spawns asynchronous parsing and DB insert loop.
*   `GET /api/upload/progress`: SSE stream reporting bulk insertion stats: `{ status, total, inserted, skipped, error }`.

### 📊 Stats & Options Metadata
*   `GET /api/stats`: Telemetry data for total count, unique companies, top 5 industries, and top 5 countries.
*   `GET /api/filters`: Returns all unique industry names, country names, email/phone statuses, and phone types for frontend filter drop-downs.

### 👥 Contacts Queries
*   `GET /api/contacts`: Supports pagination and detailed filters:
    *   Query parameters: `page`, `limit`, `search`, `industry`, `country`, `emailType`, `phoneType`, `emailStatus`, `phoneStatus`, `company`, `position`, `city`, `emailSource`

### 📂 Saved Lists Management
*   `POST /api/lists`: Captures current contact filter state and stores matching contacts under a new list.
*   `GET /api/lists`: Lists all saved lists along with contact counts and tags.
*   `PUT /api/lists/:id`: Renames list or updates tags.
*   `DELETE /api/lists/:id`: Deletes list metadata and member links.
*   `GET /api/lists/:id/contacts`: Paginated contacts within a list.
*   `GET /api/lists/:id/export`: Generates and exports a CSV download of the list members.

### 📧 Email Outreach Tab
*   `GET /api/templates`: Fetch all stored email templates.
*   `POST /api/templates`: Save a new email template.
*   `PUT /api/templates/:id`: Update an existing email template.
*   `DELETE /api/templates/:id`: Delete a template.
*   `GET /api/campaigns`: Fetch history of email campaigns.
*   `GET /api/campaigns/:id`: Fetch specific details of a campaign.
*   `GET /api/campaigns/:id/progress`: SSE stream reporting sent/failed/status telemetry in real-time.
*   `POST /api/campaigns/preview`: Check count of recipients matching specific list filters before launching.
*   `POST /api/campaigns/send`: Launches an email campaign in the background using Nodemailer.
    *   *Features automatic tag personalization*: Replaces `{{name}}`, `{{company}}`, `{{position}}`, `{{city}}`, `{{country}}`, and `{{industry}}` in subject & body.
*   `POST /api/campaigns/:id/stop`: Aborts a currently running campaign.

### 💬 WhatsApp Outreach Tab
*   `GET /api/whatsapp/templates`: Get all stored WhatsApp campaign templates.
*   `POST /api/whatsapp/templates`: Save a WhatsApp campaign template mapping, accepting optional `template_params`.
*   `DELETE /api/whatsapp/templates/:id`: Delete a template mapping.
*   `GET /api/whatsapp/campaigns`: Get history of WhatsApp campaigns.
*   `GET /api/whatsapp/campaigns/:id/progress`: SSE stream reporting WhatsApp sent/failed telemetry in real-time.
*   `POST /api/whatsapp/send`: Launches a WhatsApp broadcast campaign via the AiSensy REST API endpoint.
    *   Integrates destination phone sanitation, maps Designation, LinkedIn, Email, and Company to custom AiSensy attributes, and accepts / maps customizable `templateParams` dynamically.

---

## 🔒 Authentication & Credentials

Authentication is simulated on the frontend and persists in `localStorage`:
*   **Key**: `gld_auth` set to `"true"`
*   **Route**: Handled by [LoginPage.jsx](file:///c:/Users/91901/Downloads/GLD%20Mine/GLD%20Mine/webapp/src/LoginPage.jsx)
*   **Access Credentials**:
    *   **Username**: `wolverine`
    *   **Password**: `iNcorrectpAssword@123`

---

## 🌐 Environment Variables (`.env`)

Located in the project root:
*   `gmail_id`: Gmail login ID used for SMTP Nodemailer transport.
*   `gmail_pass`: App password for Gmail integration.
*   `github_repo`: Target repository url.
*   `github_token`: Personal Access Token for Github synchronization.
*   `aisensy_api`: API key for the AiSensy WhatsApp template messaging API.

---

## 🎨 Styling & Design Tokens

Styles are controlled in `webapp/src/index.css` under the modern glassmorphism aesthetic:
*   `--bg-primary`: `#09090b` (Deep dark background)
*   `--bg-secondary`: `#18181b` (Container background)
*   `--bg-glass`: `rgba(255, 255, 255, 0.03)` (Frosted overlay)
*   `--border-glass`: `rgba(255, 255, 255, 0.08)` (Subtle glass border)
*   `--accent`: `#8b5cf6` (Deep violet accent)
*   `--accent-light`: `#a78bfa` (Light violet label highlight)
*   `--accent-glow`: `rgba(139, 92, 246, 0.25)` (Glow shadows/focus highlights)
*   **Typography**: *Inter* for body copy, *Outfit* for headers.
