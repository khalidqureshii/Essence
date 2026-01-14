import os
from groq import Groq
import asyncio
from typing import List, Dict

class MemoryAgent:
    def __init__(self, api_key: str, model_name: str):
        self.client = Groq(api_key=api_key)
        self.model = model_name
        self.history = []

    async def update_memory(self, state_snapshot: Dict):
        # Fire-and-forget sync to Gemma
        # In a real scenario, this would compress history and track resolved/unresolved critiques
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._process_memory, state_snapshot)

    def _process_memory(self, state_snapshot: Dict):
        # Placeholder for Gemma-based history compression and tracking
        # This runs in background and never blocks the user
        prompt = f"Background Memory Update:\nState: {state_snapshot}\nCompress history and track state."
        try:
            # Using synchronous Groq call in executor for fire-and-forget
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500
            )
            # Log or store result internally
            print(f"Memory Agent Updated: {response.choices[0].message.content[:50]}...")
        except Exception as e:
            print(f"Memory Agent Error: {e}")

    def get_context(self) -> str:
        # Returns a compressed summary for the Thinking Agent
        return "Previous critique summary placeholder."
