from fastapi import FastAPI
from database import engine
from models import Base
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, peers, tasks, websockets

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://letsgetitdone.vercel.app",
        "https://slick.wtf",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

@app.get("/")
def home():
    return {"message": "Todo API running 🚀"}

app.include_router(auth.router)
app.include_router(peers.router)
app.include_router(tasks.router)
app.include_router(websockets.router)