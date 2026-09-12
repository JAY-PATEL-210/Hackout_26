# Predictive Maintenance Platform

A full-stack predictive maintenance platform featuring an ML/FastAPI backend and a React + Vite + Tailwind CSS + React Router dashboard.

## Project Structure

```
predictive-maintenance-platform/
├── backend/
│   ├── data/          # Generated CSV datasets
│   ├── models/        # Trained model files
│   ├── main.py        # FastAPI application
│   └── requirements.txt
├── frontend/          # React + Vite + Tailwind CSS + React Router + Recharts
└── .gitignore
```

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Backend API will run at `http://127.0.0.1:8000`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend dashboard will run at `http://127.0.0.1:5173`.
