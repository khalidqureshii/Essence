from dataclasses import dataclass, field
from typing import Optional, Dict, AsyncGenerator
from enum import Enum
import time
import asyncio
import logging
import base64

# Define the ActiveTurnContext as the single authoritative object
@dataclass
class ActiveTurnContext:
    active: bool = False
    transcript: str = ""
    typed_text: str = ""
    screenshot: Optional[str] = None # Base64 string
    screen_source: Optional[str] = None # "shared" | "pasted" | None
    sources: Dict[str, bool] = field(default_factory=lambda: {"audio": False, "text": False, "image": False})
    started_at: float = field(default_factory=time.time)

    def reset(self):
        self.active = False
        self.transcript = ""
        self.typed_text = ""
        self.screenshot = None
        self.screen_source = None
        self.sources = {"audio": False, "text": False, "image": False}
        self.started_at = time.time()

class TurnManager:
    def __init__(self, orchestrator, stt_agent):
        self.context = ActiveTurnContext()
        self.orchestrator = orchestrator
        self.stt_agent = stt_agent
        self.logger = logging.getLogger("TurnManager")
        self.is_responding = False
        self.turn_audio = bytearray()
        # Track triggered commands to avoid duplicates in accumulating transcript
        self.triggered_commands = {"screenshot": False}

    def get_context_snapshot(self):
        return {
            "active": self.context.active,
            "transcript": self.context.transcript,
            "typed_text": self.context.typed_text,
            "has_screenshot": bool(self.context.screenshot),
            "sources": self.context.sources,
            "is_responding": self.is_responding
        }

    async def process_audio_chunk(self, audio_bytes: bytes) -> AsyncGenerator[dict, None]:
        """
        Process incoming audio chunks.
        Accumulates audio for the turn and re-transcribes the growing buffer
        to ensure valid WebM headers and full context.
        """
        if self.is_responding:
            return

        self.turn_audio.extend(audio_bytes)
        
        try:
            # Transcribe the FULL audio buffer so far
            full_transcript = await self.stt_agent.transcribe_bytes(bytes(self.turn_audio))
            if full_transcript:
                # Use the unified text handler
                async for response in self.process_text_input(full_transcript, source="audio"):
                    yield response
        except Exception as e:
            self.logger.warning(f"Audio processing warning: {e}")

    async def handle_image_input(self, image_b64: str, source: str = "shared"):
        """
        Handles image input. 
        """
        if self.is_responding:
            self.logger.info("Ignoring image input while responding.")
            return

        # We store the full Data URI (including prefix) to preserve mime type 
        # for proper frontend rendering when confirmed back.
        self.context.screenshot = image_b64
        self.context.screen_source = source
        self.context.sources["image"] = True
        self.context.active = True
        self.logger.info(f"Context Image Updated from source: {source}")

    async def handle_commit(self) -> AsyncGenerator[dict, None]:
        """
        Triggers the interaction.
        """
        if not self.context.active and not self.context.typed_text and not self.context.screenshot:
             self.logger.info("Commit called but context is empty/inactive. Ignoring.")
             return

        self.is_responding = True
        yield {"type": "state_update", "payload": "RESPONDING"}

        full_prompt = f"{self.context.transcript} {self.context.typed_text}".strip()
        
        self.logger.info(f"Committing Turn. Prompt: {full_prompt}, Has Image: {bool(self.context.screenshot)}")

        # Prepare confirmation text with explicit "Audio:" tag if audio was a source
        # User requested: "Audio: Transcription of what I said"
        display_text = full_prompt
        if self.context.sources.get("audio"):
            display_text = f"Audio: {full_prompt}"

        # Send confirmation to client
        yield {
            "type": "commit_confirmation", 
            "payload": {
                "text": display_text, 
                "image": self.context.screenshot # Sends full Data URI now
            }
        }

        try:
            # Orchestrator likely expects raw base64 (no header), so we strip it here for processing
            processing_image = self.context.screenshot
            if processing_image and "," in processing_image:
                processing_image = processing_image.split(",", 1)[1]

            async for chunk in self.orchestrator.run_flow(full_prompt, processing_image):
                yield {"type": "response_chunk", "payload": chunk}
                
        except Exception as e:
            self.logger.error(f"Error during reasoning: {e}")
            yield {"type": "response_chunk", "payload": f"Error: {str(e)}"}
            
        finally:
            self.context.reset()
            self.turn_audio.clear()
            self.triggered_commands = {"screenshot": False}
            self.is_responding = False
            yield {"type": "state_update", "payload": "ACTIVE" if self.context.active else "INACTIVE"}

    def start_turn(self):
        if not self.context.active:
            self.context.active = True
            # self.context.started_at = time.time() # defined in dataclass, but good to reset if needed? 
            # Ideally reset method handles clean state, start_turn just marks active.
            self.logger.info("Turn started")

    async def process_text_input(self, text: str, source: str = "audio", mode: str = "replace") -> AsyncGenerator[dict, None]:
        """
        Unified handler for all text input (Audio Transcript or Typed Text).
        Handles:
        - Wake word detection
        - Command detection (Screenshot)
        - Commit phrase detection
        - Context updating
        """
        if not text.strip():
            return

        if self.is_responding:
            return
        
        # Debug Log
        self.logger.info(f"ACTIVE={self.context.active} TEXT={text}")

        lower_text = text.lower()
        
        # 1. Wake ID / Start
        # Ensure turn is active if we hear wake word OR if we have audio input (Implicit)
        if "essence" in lower_text:
            self.start_turn()
        
        elif source == "audio" and not self.context.active:
            # Preferred fix: Auto-start turn on speech since mic is explicit
            self.start_turn()

        # 2. Screenshot keywords
        screenshot_triggers = ["screenshot", "capture", "do you see this", "look at this"]
        if not self.triggered_commands["screenshot"]:
            if any(trigger in lower_text for trigger in screenshot_triggers):
                 self.start_turn() # Ensure active if command given
                 self.triggered_commands["screenshot"] = True
                 yield {"type": "command", "payload": "capture_screenshot"}
        
        # 3. Commit keywords (Only if active or explicitly typed?)
        commit_triggers = ["over", "your turn"]
        should_commit = any(trigger in lower_text for trigger in commit_triggers)

        # 4. Context Update
        if source == "text":
            self.start_turn() # Typed text always starts/is part of turn
            if mode == "replace":
                self.context.typed_text = text
            else:
                self.context.typed_text += text + " "
            self.context.sources["text"] = True
            
        elif source == "audio":
             if self.context.active:
                self.context.transcript = text
                self.context.sources["audio"] = True
                yield {"type": "transcript_update", "payload": self.context.transcript}

        # 5. Commit Trigger
        if should_commit:
            async for msg in self.handle_commit():
                yield msg
