# GLD Mine Full-Stack Deployment Guide

This guide provides a comprehensive, step-by-step walkthrough to deploy your **GLD Mine (Data Intelligence Hub)** application to the cloud.

---

## 🏗️ Architecture Overview

The GLD Mine application consists of two main parts:
1. **Frontend (`webapp`)**: A React Single Page Application (SPA) powered by Vite.
2. **Backend (`backend`)**: An Express.js REST API server that utilizes a local SQLite database (`database.sqlite`) to store campaign history, saved lists, templates, and contact data.

### Why Dual Deployment?
* **Vercel** is an exceptional platform for **static and frontend** applications.
* However, **Vercel Serverless Functions are ephemeral and read-only**. This means that if you try to host the Node Express backend with SQLite on Vercel, **your SQLite database file will be wiped every time the serverless function spins down or restarts**, causing absolute data loss!
* **The Solution**: 
  * Deploy the **React Frontend on Vercel** (fast, free global CDN).
  * Deploy the **Node Express Backend on Render** (free tier Node.js web services with disk persistence) or **Railway** (low-cost persistent database volumes). This ensures your SQLite database file remains persistent and files uploaded via the import tab are stored safely.

---

## 🛠️ Codebase Upgrades (Completed)

To make your deployment extremely smooth and completely "plug-and-play," the following codebase improvements have already been made automatically:
1. **Dynamic Backend URL Support**: Changed the hardcoded `http://localhost:3001` URL to a dynamic check `import.meta.env.VITE_API_BASE` in the following frontend files:
   * [App.jsx](file:///C:/Users/91901/Downloads/GLD%20Mine/GLD%20Mine/webapp/src/App.jsx)
   * [CampaignsTab.jsx](file:///C:/Users/91901/Downloads/GLD%20Mine/GLD%20Mine/webapp/src/CampaignsTab.jsx)
   * [WhatsappTab.jsx](file:///C:/Users/91901/Downloads/GLD%20Mine/GLD%20Mine/webapp/src/WhatsappTab.jsx)
   * [TemplatesTab.jsx](file:///C:/Users/91901/Downloads/GLD%20Mine/GLD%20Mine/webapp/src/TemplatesTab.jsx)
   * [UploaderTab.jsx](file:///C:/Users/91901/Downloads/GLD%20Mine/GLD%20Mine/webapp/src/UploaderTab.jsx)
   * *This ensures local development works perfectly on `localhost:3001` while production automatically points to your hosted cloud backend.*
2. **Start Script**: Added a standard `"start": "node server.js"` command inside [backend/package.json](file:///C:/Users/91901/Downloads/GLD%20Mine/GLD%20Mine/backend/package.json) so hosting platforms know exactly how to run the server.
3. **Database Disk Mounting**: Modified the database initialization inside [backend/server.js](file:///C:/Users/91901/Downloads/GLD%20Mine/GLD%20Mine/backend/server.js) to support a `DATABASE_PATH` environment variable. This allows you to mount a persistent disk volume to prevent data loss.

---

## 🚀 Step-by-Step Deployment Instructions

### Step 1: Push your Code to GitHub
Ensure all your files (including the newly edited ones) are pushed to a remote GitHub repository.
1. Initialize Git in the project root if you haven't:
   ```bash
   git init
   git add .
   git commit -m "chore: prepare codebase for cloud deployment"
   ```
2. Create a repository on GitHub (e.g., `GoldMine`).
3. Link your local project to GitHub and push:
   ```bash
   git remote add origin https://github.com/your-username/GoldMine.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 2: Deploy the Backend (Render or Railway)

Choose one of the following methods to host your Express.js backend. We recommend **Render** as it has a generous free tier with persistent disk support.

#### Option A: Deploy on Render (Recommended & Free)
1. Sign up/Log in to [Render](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and select your repository.
4. Configure the Web Service settings:
   * **Name**: `gld-mine-backend`
   * **Region**: Choose the region closest to your users.
   * **Branch**: `main`
   * **Root Directory**: `GLD Mine/backend` (or simply `backend` depending on how your repo is structured)
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
5. Click **Advanced** and add your Environment Variables from your `.env` file:
   * `gmail_id` = `marketing@xmonks.com`
   * `gmail_pass` = `wtck ffus hnda qzfn`
   * `aisensy_api` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   * `DATABASE_PATH` = `/var/data/database.sqlite` (This tells SQLite to store data inside the Render persistent volume disk!)
6. **Configure Disk Persistence (Crucial)**:
   * Scroll down to the **Disks** section in Render's advanced options (or go to the **Disks** tab in your service dashboard after creation).
   * Click **Add Disk**.
   * **Name**: `sqlite-data`
   * **Mount Path**: `/var/data`
   * **Size**: `1 GB` (This is more than enough and free on Render!)
7. Click **Create Web Service**. Render will now build and deploy your Express server. Once done, copy the generated URL (e.g., `https://gld-mine-backend.onrender.com`).

---

#### Option B: Deploy on Railway (Fast & Highly Performant)
1. Log in to [Railway.app](https://railway.app).
2. Click **New Project** -> **Deploy from GitHub repo** and select your repository.
3. Once the repo is imported, click on the newly created card and go to **Settings**:
   * Change **Root Directory** to `/GLD Mine/backend` (or `/backend`).
4. Go to the **Variables** tab and click **New Variable** to add:
   * `gmail_id`
   * `gmail_pass`
   * `aisensy_api`
   * `PORT` = `3001`
   * `DATABASE_PATH` = `/data/database.sqlite`
5. Go to the **Volumes** tab:
   * Click **Add Volume**.
   * **Mount Path**: `/data`
6. Go to **Settings** -> **Public Networking** -> click **Generate Domain** to get your public API URL (e.g., `https://backend-production.up.railway.app`).

---

### Step 3: Deploy the Frontend on Vercel

1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. Configure the project:
   * **Framework Preset**: `Vite` (Vercel automatically detects this).
   * **Root Directory**: Click *Edit* and select the `GLD Mine/webapp` (or `webapp`) folder.
   * **Build and Output Settings**: Leave as default (`npm run build` and output directory `dist` are automatically handled).
5. **Add Environment Variables (Crucial)**:
   * Under the **Environment Variables** dropdown, add:
     * **Key**: `VITE_API_BASE`
     * **Value**: `<YOUR_BACKEND_URL>/api` (e.g., `https://gld-mine-backend.onrender.com/api` or `https://backend-production.up.railway.app/api`)
     * > [!IMPORTANT]
     * > Make sure your backend URL does **not** end with a slash before `/api`. It should look exactly like: `https://gld-mine-backend.onrender.com/api`.
6. Click **Deploy**. Vercel will build your static React client and distribute it on their global Edge Network.
7. Within 1 minute, you will receive a public production URL (e.g., `https://gld-mine.vercel.app`)!

---

## 🧪 Post-Deployment Checklist

1. **Test the Login**: Navigate to your Vercel URL and log in using your credentials:
   * **Username**: `wolverine`
   * **Password**: `iNcorrectpAssword@123`
2. **Verify API Connection**: Ensure the dashboard statistics load correctly (this means Vercel is communicating with Render/Railway successfully).
3. **Test CSV Import**: Go to the **Import** tab and upload a test CSV. Verify the SSE progress bar updates and the contacts list successfully populated.
4. **Test Campaign Outreach**: Create a test template, filter a list, and trigger a test email outreach to confirm the Gmail SMTP transporter behaves correctly.

---

## 🔒 Security Best Practices

> [!WARNING]
> Your local project contains a `.env` file with critical API keys. 
> Ensure `.env` is listed in your `.gitignore` file before pushing to any public GitHub repository so your email passwords and AiSensy keys are never exposed.

---
*Happy deploying! If you run into any build errors or connection issues during this process, simply let me know and I will help you debug immediately.*
