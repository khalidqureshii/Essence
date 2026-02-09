from dataclasses import dataclass, field
from typing import Optional, Dict, AsyncGenerator, List
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
    screenshots: List[str] = field(default_factory=list) # List of Base64 strings
    screen_source: Optional[str] = None # "shared" | "pasted" | None
    sources: Dict[str, bool] = field(default_factory=lambda: {"audio": False, "text": False, "image": False})
    started_at: float = field(default_factory=time.time)

    def reset(self):
        self.active = False
        self.transcript = ""
        self.typed_text = ""
        self.screenshots = []
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
            "has_screenshot": len(self.context.screenshots) > 0,
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
        self.context.screenshots.append(image_b64)
        self.context.screen_source = source
        self.context.sources["image"] = True
        self.context.active = True
        self.logger.info(f"Context Image Added from source: {source}. Total: {len(self.context.screenshots)}")

    async def handle_commit(self) -> AsyncGenerator[dict, None]:
        """
        Triggers the interaction.
        """
        if not self.context.active and not self.context.typed_text and not self.context.screenshots:
             self.logger.info("Commit called but context is empty/inactive. Ignoring.")
             return

        self.is_responding = True
        yield {"type": "state_update", "payload": "RESPONDING"}

        full_prompt = f"{self.context.transcript} {self.context.typed_text}".strip()
        
        self.logger.info(f"Committing Turn. Prompt: {full_prompt}, Images: {len(self.context.screenshots)}")

        # Send confirmation to client
        yield {
            "type": "commit_confirmation", 
            "payload": {
                "text": full_prompt, 
                "images": self.context.screenshots # Sends list of full Data URIs
            }
        }

        try:
            # Orchestrator likely expects raw base64 (no header), so we strip them here for processing
            processing_images = []
            for img in self.context.screenshots:
                if "," in img:
                    processing_images.append(img.split(",", 1)[1])
                else:
                    processing_images.append(img)

            # Note: We need to update Orchestrator to handle multiple images
            async for chunk in self.orchestrator.run_flow(full_prompt, processing_images):
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

        # 2. Screenshot keywords (DISABLED as per user request - only manual click allowed)
        # screenshot_triggers = [
        #     "screenshot", "capture", "do you see this", "look at this", 
        #     "take a screenshot", "take screenshot", "capture screen"
        # ]
        # if not self.triggered_commands["screenshot"]:
        #     if any(trigger in lower_text for trigger in screenshot_triggers):
        #          self.start_turn() # Ensure active if command given
        #          self.triggered_commands["screenshot"] = True
        #          yield {"type": "command", "payload": "capture_screenshot"}
        
        # 3. Commit keywords (Only if active or explicitly typed?)
        commit_triggers = ["over", "your turn"]
        should_commit = any(trigger in lower_text for trigger in commit_triggers)

        # 4. Context Update
        # Clean the text if it contains commit triggers to avoid trailing "over" etc.
        cleaned_text = text
        if should_commit:
            for trigger in commit_triggers:
                if trigger in lower_text:
                    # Find the case-insensitive index to preserve original case if possible, 
                    # but usually, we just want to remove the trigger word.
                    # A robust way is to use regex or find/replace on the lower version 
                    # but apply to original.
                    start_idx = lower_text.find(trigger)
                    if start_idx != -1:
                        cleaned_text = text[:start_idx].strip()
                        # Remove trailing punctuation often added by STT
                        cleaned_text = cleaned_text.rstrip(".,?!")
                        break

        if source == "text":
            self.start_turn() # Typed text always starts/is part of turn
            if mode == "replace":
                self.context.typed_text = cleaned_text
            else:
                self.context.typed_text += cleaned_text + " "
            self.context.sources["text"] = True
            
        elif source == "audio":
             if self.context.active:
                self.context.transcript = cleaned_text
                self.context.sources["audio"] = True
                yield {"type": "transcript_update", "payload": self.context.transcript}

        # 5. Commit Trigger
        if should_commit:
            async for msg in self.handle_commit():
                yield msg
