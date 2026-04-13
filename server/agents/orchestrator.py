from agents.thinking_agent import ThinkingAgent
from typing import Optional, List
import asyncio

class AgentOrchestrator:
    def __init__(self, groq_api_key: str, thinking_model: str, memory_model: str):
        from agents.memory_agent import MemoryAgent
        from agents.conversation_manager import ConversationManager
        from agents.resume_manager import ResumeConversationManager
        
        self.thinking_agent = ThinkingAgent(groq_api_key, thinking_model)
        self.memory_agent = MemoryAgent(groq_api_key, memory_model)
        self.conversation_manager = ConversationManager()
        self.resume_manager = ResumeConversationManager()
        self.current_mode = "project"

    def set_mode(self, mode: str, resume_text: str = "", focus_mode: str = "general", time_limit_mins: int = 15):
        self.current_mode = mode
        if mode == "resume":
            self.resume_manager.setup_interview(resume_text, focus_mode, time_limit_mins)
            
    async def run_flow(self, transcript: str, image_data: List[str] = None):
        manager = self.resume_manager if self.current_mode == "resume" else self.conversation_manager
        
        # 1. Get State-Specific Instructions
        system_prompt = manager.get_state_instruction(
            transcript, 
            has_image=(image_data and len(image_data) > 0)
        )
        
        # 2. Get History
        history = manager.history
        
        # 3. Get Memory
        memory_context = self.memory_agent.get_context()
        
        # 4. Stream Response
        # We need to capture the full response to update state history
        full_response = ""
        
        # Note: ThinkingAgent.stream_critique might need update for multiple images.
        # For now, we pass the first image if available, or the list if it supports it.
        # Looking at previous code, it seems it expected a single string.
        primary_image = image_data[0] if image_data and len(image_data) > 0 else None

        async for chunk in self.thinking_agent.stream_critique(
            transcript, 
            primary_image, 
            memory_context, 
            history=history,
            custom_system_prompt=system_prompt,
            mode=self.current_mode
        ):
            full_response += chunk
            yield chunk

        # 5. Update Conversation State & History (Main Thread)
        manager.update_history(transcript, full_response)
        manager.check_state_transition(transcript, full_response)
        
        # 6. Parallel fire-and-forget long-term memory update
        state_snapshot = {
            "transcript": transcript,
            "has_images": image_data is not None and len(image_data) > 0,
            "num_images": len(image_data) if image_data else 0,
            "timestamp": "now"
        }
        asyncio.create_task(self.memory_agent.update_memory(state_snapshot))

    def reset_conversation(self):
        self.conversation_manager.reset()
        self.resume_manager.reset()
