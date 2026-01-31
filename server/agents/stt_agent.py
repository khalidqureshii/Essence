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
                    language=Config.TRANSCRIPTION_LANGUAGE,
                    response_format="verbose_json",
                )
                return transcription.text
        
        return await loop.run_in_executor(None, _transcribe)


    async def transcribe_bytes(self, audio_bytes: bytes) -> str:
        # Create a named pipe or temp file for the bytes
        loop = asyncio.get_event_loop()
        def _transcribe():
            import io
            # Create a file-like object with a name, as Groq/OpenAI client often needs a filename hint
            # We use a BytesIO but we might need to conform to what the library expects.
            # However, typically the client expects (filename, file_object).
            
            # Using a temporary file is safer for compatibility with some libraries that check file paths
            import tempfile
            # Note: Browser MediaRecorder typically sends WebM or Ogg Opus. 
            # Whisper/Groq handles these, but the file extension hints the format.
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            
            try:
                with open(tmp_path, "rb") as file:
                    transcription = self.client.audio.transcriptions.create(
                        file=("audio.webm", file),
                        model=Config.WHISPER_MODEL,
                        language=Config.TRANSCRIPTION_LANGUAGE,
                        response_format="verbose_json",
                    )
                return transcription.text
            except Exception as e:
                # Log error but don't crash? 
                # print(f"STT Error: {e}") 
                return ""
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        return await loop.run_in_executor(None, _transcribe)

# Singleton instance
stt_agent = STTAgent()

