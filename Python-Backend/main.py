from email import message
import logging
from chatbot import chat
from fastapi import FastAPI, HTTPException  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
import uvicorn  # type: ignore
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
    
@app.post("/chatbot")
async def chatbot_endpoint(request: ChatRequest):
    print(f"Received chatbot request: {request}")
    try:
        user_input = request.message
        if not user_input:
            raise HTTPException(status_code=400, detail="Message is required")

        bot_reply = chat(user_input)
        return {"success": True, "reply": bot_reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")

@app.get("/")
def root():
    return {"message": "Essence - an Agentic Critic API is running!"}    

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
