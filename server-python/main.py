import logging
import os
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
import asyncio

from config import Config
from agents.stt_agent import stt_agent
from agents.orchestrator import AgentOrchestrator
from agents.turn_manager import TurnManager

app = FastAPI(title="Essence Agentic Critique API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Main")

# Global dependencies
orchestrator = AgentOrchestrator(
    groq_api_key=Config.GROQ_API_KEY,
    thinking_model=Config.THINKING_MODEL,
    memory_model=Config.MEMORY_MODEL
)

# We might want one TurnManager per connection, or global?
# "There is exactly ONE Active Turn Context object." - Usually implies per-session.
# For a simple local-user scenario, global is fine, but per-websocket is safer.
# User said "The user has 1 active workspaces", implies single user.
# But good practice: Instantiate TurnManager per WebSocket session.

@app.websocket("/chatbot/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    turn_manager = TurnManager(orchestrator, stt_agent)
    logger.info("WebSocket connected. TurnManager initialized.")
    audio_buffer = bytearray()

    try:
        while True:
            # Receive message (could be text JSON or binary audio)
            # We need to handle both.
            # Fastapi websocket doesn't easily support "receive any".
            # We can try receive_text or receive_bytes.
            # Client should probably send JSON for commands/text and Binary for audio?
            # Or we can check the message type if we use `receive()`.
            
            message = await websocket.receive()
            
            if "text" in message:
                data = message["text"]
                # Try to parse as JSON command
                try:
                    payload = json.loads(data)
                    event_type = payload.get("type")
                    
                    if event_type == "text_input":
                        async for response in turn_manager.process_text_input(
                            payload.get("text", ""), 
                            source="text", 
                            mode=payload.get("mode", "append")
                        ):
                            await websocket.send_json(response)
                        
                    elif event_type == "image_input":
                        await turn_manager.handle_image_input(payload.get("image", ""), payload.get("source", "pasted"))
                        
                    elif event_type == "commit":
                        logger.info("🔔 Commit received, transcribing audio")

                        audio_bytes = bytes(audio_buffer)
                        audio_buffer.clear()

                        logger.info(f"🎧 Audio buffer size: {len(audio_bytes)} bytes")

                        if audio_bytes:
                            transcript = await stt_agent.transcribe_bytes(audio_bytes)

                            if transcript:
                                async for response in turn_manager.process_text_input(
                                    transcript,
                                    source="audio",
                                    mode="replace"
                                ):
                                    await websocket.send_json(response)

                        # Then finalize the turn
                        async for response in turn_manager.handle_commit():
                            await websocket.send_json(response)

                            
                    elif event_type == "reset":
                         turn_manager.context.reset()
                         orchestrator.reset_conversation()
                         turn_manager.turn_audio.clear()
                         turn_manager.triggered_commands = {"screenshot": False}
                         await websocket.send_json({"type": "state_update", "payload": turn_manager.get_context_snapshot()})

                    # Send updated context state/transcript back if needed (or TurnManager yields it?)
                    # TurnManager methods above didn't yield for input updates, strictly speaking.
                    # We might want to send an ack or update.
                    # Let's send a generic state update.
                    await websocket.send_json({"type": "state_update", "payload": turn_manager.get_context_snapshot()})
                        
                except json.JSONDecodeError:
                    logger.warning("Received non-JSON text message")

            if "bytes" in message:
                audio_data = message["bytes"]
                audio_buffer.extend(audio_data)
            # if "bytes" in message:
            #     audio_data = message["bytes"]
            #     # Process audio chunk
            #     # In a real implementation, we'd transcribe here.
            #     # Since STT is currently file-based or slow-ish, we might need a workaround.
            #     # But complying with the requested architecture:
                
            #     # 1. Transcribe (simulated buffering or direct call if STT supports bytes)
            #     # We need to add `transcribe_bytes` to STT agent or save to temp.
            #     # Let's save to temp for now to reuse existing STT.
                
            #     # Optimisation: Only transcribe every N chunks or 1-2 seconds?
            #     # For "One coherent pass", let's transcribe every chunk if it's large enough?
            #     # Better: Queue it and background task transcribe?
            #     # User said "Continuously transcribe speech".
                
            #     # For this implementation to be "simple" and "correct" on semantics:
            #     # We will perform transcription.
                
            #     transcript_segment = await stt_agent.transcribe_bytes(audio_data)
            #     if transcript_segment:
            #         async for response in turn_manager.process_text_input(transcript_segment, source="audio"):
            #             await websocket.send_json(response)
            #             # If the response was a command (capture), sending it back allows client to act.
            #             # If it was a commit response stream, we sent it.

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except RuntimeError as e:
        if "disconnect message" in str(e) or "websocket.close" in str(e):
             logger.info("WebSocket connection closed")
        else:
             logger.error(f"WebSocket Runtime Error: {e}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        # Only attempt close if not already closed
        try:
            await websocket.close()
        except:
            pass

@app.get("/")
def root():
    return {"message": "Essence Multi-Agent Critique API is running!"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
