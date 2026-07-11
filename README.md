<div align="center">
  <h1>GETitDONE</h1>
  <p><strong>A peer-to-peer productivity engine driven by the Whuffie reputation economy.</strong></p>
  <p>
    <a href="https://letsgetitdone.vercel.app">Live App</a> • 
    <a href="ARCHITECTURE.md">System Architecture</a>
  </p>
</div>

---

## The Pitch
Traditional to-do apps are lonely. **GETitDONE** is different. It is a highly opinionated, minimalist productivity tool designed for teams, friends, and collaborators. 

Instead of just assigning tasks into the void, GETitDONE is powered by **Whuffies**—a reputation-based micro-economy. 
* **Wager to Assign:** Want a peer to do something? It costs you Whuffies to assign them a task.
* **Earn by Completing:** Complete tasks assigned to you by your peers to earn their Whuffies and build your reputation.

It forces intentionality. You only assign tasks when they truly matter, and you get rewarded when you put in the work.

## Key Features
* **The Whuffie Economy:** A zero-sum reputation economy that gamifies peer-to-peer task delegation.
* **Real-Time Collaboration:** Powered by WebSockets. When a peer assigns you a task, your dashboard updates instantly without refreshing.
* **Drag-and-Drop Kanban:** A buttery-smooth, distraction-free board to manage your state of work.
* **Deep Activity History:** Every assignment, revocation, update, and completion is meticulously tracked in a collapsible history log.
* **Peer Networking:** Build your network by sending and accepting peer requests via email.

## Tech Stack
GETitDONE is built on a decoupled, modern web stack designed for speed and modularity.

* **Frontend:** React (Vite), React Router, Context API
* **Backend:** Python, FastAPI, SQLAlchemy
* **Database:** Serverless PostgreSQL (Neon)
* **Real-time:** FastAPI WebSockets

> **Want to see how it works under the hood?**
> Check out the [ARCHITECTURE.md](ARCHITECTURE.md) file for a deep dive into the folder structure, data flow, and deployment strategy!

## Local Development (Quickstart)

Want to run GETitDONE on your own machine? It requires two separate terminal windows (one for the React frontend, one for the Python backend).

### 1. Start the Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
*The API will be available at http://localhost:8000*

### 2. Start the Frontend (React)
```bash
cd frontend
npm install
npm run dev
```
*The app will be available at http://localhost:5173*
