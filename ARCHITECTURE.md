# GETitDONE - Architecture & Deployment Overview

This document explains the high-level architecture of the **GETitDONE** Todo Application, detailing how the local development environment maps to the live production cloud environment.

## 🏗 System Architecture

The application is split into three completely decoupled tiers:
1. **Frontend (The UI)**: Built with React and Vite.
2. **Backend (The Brains)**: Built with Python and FastAPI.
3. **Database (The Storage)**: Powered by PostgreSQL.

By splitting these up, we ensure that the frontend can be loaded globally at lightning speed, while the backend securely handles the heavy lifting and data processing.

---

## ☁️ The Cloud Infrastructure

When moving from a local Mac to the internet, we replaced the local services with three specialized cloud platforms:

### 1. Vercel (The Frontend Host)
**What it replaces:** Running `npm run dev` in your Mac's terminal.
**What it does:** 
Vercel is a global Content Delivery Network (CDN) optimized for React applications. When you push your code to GitHub, Vercel automatically downloads your `frontend` folder, compiles the React code into static HTML, CSS, and JavaScript files, and distributes them to servers all around the world. When a user visits your `.vercel.app` link, the site loads almost instantly because it is being served from a physical server geographically close to them.

### 2. Render.com (The Backend Host)
**What it replaces:** Running `uvicorn main:app --reload` in your Mac's terminal.
**What it does:**
Render is a cloud platform that runs your actual Python code 24/7. It listens to GitHub, downloads your `backend` folder, installs all your Python libraries from `requirements.txt`, and boots up your FastAPI server. It exposes a public URL (`getitdone-app.onrender.com`) that your Vercel frontend can talk to. 
> [!NOTE]
> Because we are on the free tier, Render puts the server to "sleep" after 15 minutes of inactivity. This is why the very first login of the day might take 30-50 seconds while the server wakes up.

### 3. Neon.tech (The Database)
**What it replaces:** The local PostgreSQL database running silently in the background of your Mac (via Homebrew).
**What it does:**
Neon is a "Serverless PostgreSQL" database. Instead of storing your users and tasks on your Mac's hard drive, Neon stores them securely in the cloud. It provides a Connection String URL (`postgresql://...`) that acts as a secure tunnel. Your Python backend uses this URL to read and write data to Neon.

---

## 🔄 How They Connect

Here is the step-by-step flow of data when a user logs into the app:

1. **The User** opens the Vercel URL on their phone. Vercel immediately sends the React website to their browser.
2. The User types their email and password and clicks "Log In".
3. **The Frontend (React)** takes that email and password and sends a secure HTTP POST request to your **Render Backend API** (`https://getitdone-app.onrender.com/login`).
4. **The Backend (FastAPI)** receives the request. It uses the `DATABASE_URL` to securely ask the **Neon Database**: *"Hey, do you have a user with this email, and does the password hash match?"*
5. **The Database (Neon)** replies to Render: *"Yes, the password matches!"*
6. **The Backend** generates a secure JWT token and sends it back to the Frontend.
7. **The Frontend** saves this token and redirects the user to the Dashboard!

---

## 🚀 How the Data Migration Worked

When we deployed the app, your new Neon cloud database was completely empty. To prevent you from losing your existing accounts, we performed a **Database Dump and Restore**:

1. **`pg_dump`**: We ran this tool on your Mac. It literally connected to your local database, read all the rows of data, and wrote them out as standard SQL `INSERT` text commands into a file called `backup.sql`.
2. **`psql`**: We ran this tool, but pointed it at your Neon database URL. It read the `backup.sql` file line-by-line and executed all those `INSERT` commands on the cloud, perfectly mirroring your local data!
