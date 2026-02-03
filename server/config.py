import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    # LLaMA 4 Scout (Vision) - Using llama-3.2-11b-vision-preview as placeholder if scout not available
    THINKING_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct" 
    
    # Llama 3.1 8B - High quality small model for memory
    MEMORY_MODEL = "llama-3.1-8b-instant" 
    
    # Audio whisper
    WHISPER_MODEL = "whisper-large-v3"
    TRANSCRIPTION_LANGUAGE = "en"

    # Report Generation
    GEMINI_API_KEY = os.getenv("CHATBOT_API_KEY")
    REPORT_MODEL = "gemini-2.5-flash"

    DEBUG = True
