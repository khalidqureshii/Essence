from agents.thinking_agent import ThinkingAgent
from typing import Optional
import asyncio

class AgentOrchestrator:
    def __init__(self, groq_api_key: str, thinking_model: str, memory_model: str):
        from agents.memory_agent import MemoryAgent
        self.thinking_agent = ThinkingAgent(groq_api_key, thinking_model)
        self.memory_agent = MemoryAgent(groq_api_key, memory_model)

    async def run_flow(self, transcript: str, image_data: Optional[str] = None):
        memory_context = self.memory_agent.get_context()
        
        async for chunk in self.thinking_agent.stream_critique(transcript, image_data, memory_context):
            yield chunk

        # Parallel fire-and-forget memory update
        state_snapshot = {
            "transcript": transcript,
            "has_image": image_data is not None,
            "timestamp": "now"
        }
        asyncio.create_task(self.memory_agent.update_memory(state_snapshot))
