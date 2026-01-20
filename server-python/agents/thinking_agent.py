from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import JsonOutputParser
from typing import AsyncIterable, List, Dict, Optional
import json

class ThinkingAgent:
    def __init__(self, api_key: str, model_name: str):
        self.llm = ChatGroq(
            api_key=api_key,
            model_name=model_name,
            streaming=True
        )

    async def stream_critique(self, transcript: str, image_data: Optional[str] = None, memory_context: str = "", history: List[Dict] = [], custom_system_prompt: Optional[str] = None) -> AsyncIterable[str]:
        # Default prompt if no custom logic provided
        base_system_prompt = (
            "You are an Agentic Critique System. Your task is to analyze user input and optional UI screenshots.\n"
            "MANDATORY OUTPUT FORMAT:\n"
            "QUESTION: [The single most important question to ask next]\n"
            "REASONING: [Your internal reasoning and analysis of the critique]\n\n"
            "Constraints:\n"
            "- Always start with 'QUESTION: '\n"
            "- Internal reasoning must follow 'REASONING: '\n"
            "- Be concise and critical."
        )

        system_prompt = custom_system_prompt if custom_system_prompt else base_system_prompt

        messages = [SystemMessage(content=system_prompt)]
        
        # Add History
        # history is expected to be list of langchain BaseMessages or dicts
        # If they are dicts, convert? Or assume caller handles it?
        # Let's assume caller sends proper LangChain messages or we just append them if they match.
        # But `history` arg type hint says List[Dict] in my signature? 
        # Plan said List[BaseMessage]. Let's support BaseMessage.
        
        if history:
            messages.extend(history)

        # Current Turn Input
        content = [{"type": "text", "text": f"Transcript: {transcript}\nMemory Context: {memory_context}"}]
        
        if image_data:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
            })

        messages.append(HumanMessage(content=content))

        async for chunk in self.llm.astream(messages):
            if chunk.content:
                yield chunk.content
