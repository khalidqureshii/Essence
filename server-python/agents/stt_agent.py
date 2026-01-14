from groq import Groq
from config import Config
import asyncio
import os

class STTAgent:
    def __init__(self):
        self.client = Groq(api_key=Config.GROQ_API_KEY)

    async def transcribe(self, audio_path: str) -> str:
        # Running Groq transcription in a thread
        loop = asyncio.get_event_loop()
        def _transcribe():
            with open(audio_path, "rb") as file:
                transcription = self.client.audio.transcriptions.create(
                    file=(os.path.basename(audio_path), file.read()),
                    model=Config.WHISPER_MODEL,
                    response_format="verbose_json",
                )
                return transcription.text
        
        return await loop.run_in_executor(None, _transcribe)

# Singleton instance
stt_agent = STTAgent()
