import logging
from chatbot import chat
from fastapi import FastAPI, HTTPException  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel  # type: ignore

app = FastAPI(title="Crop Disease Detection API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
advisory_system = None

class ChatRequest(BaseModel):
    message: str
    language: str

@app.post("/chatbot")
async def chatbot_endpoint(request: ChatRequest):
    print(f"Received chatbot request: {request}")
    print(f"Message: {request.message}, Language: {request.language}")
    try:
        user_input = request.message
        if not user_input:
            raise HTTPException(status_code=400, detail="Message is required")

        bot_reply = chat(user_input, request.language)
        return {"success": True, "reply": bot_reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")