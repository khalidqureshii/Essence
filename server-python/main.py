import logging
import os
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
from pydantic import BaseModel
from typing import Optional
import shutil
import tempfile
import asyncio

from config import Config
from agents.stt_agent import stt_agent
from agents.orchestrator import AgentOrchestrator

app = FastAPI(title="Essence Agentic Critique API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)

# Global orchestrator
orchestrator = AgentOrchestrator(
    groq_api_key=Config.GROQ_API_KEY,
    thinking_model=Config.THINKING_MODEL,
    memory_model=Config.MEMORY_MODEL
)

@app.post("/chatbot/stream")
async def chatbot_streaming_endpoint(
    audio: Optional[UploadFile] = File(None),
    image: Optional[str] = Form(None), # base64 string
    text: Optional[str] = Form(None)
):
    try:
        transcript = text or ""
        
        # 1. STT Agent (if audio provided)
        if audio:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                shutil.copyfileobj(audio.file, tmp)
                tmp_path = tmp.name
            
            transcript = await stt_agent.transcribe(tmp_path)
            os.remove(tmp_path)

        if not transcript and not image:
            raise HTTPException(status_code=400, detail="Transcript or image is required")

        # 2. Thinking Agent & Execution Flow
        async def stream_generator():
            async for chunk in orchestrator.run_flow(transcript, image):
                yield chunk

        return StreamingResponse(stream_generator(), media_type="text/plain")

    except Exception as e:
        logging.error(f"Chatbot error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")

@app.get("/")
def root():
    return {"message": "Essence Multi-Agent Critique API is running!"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
