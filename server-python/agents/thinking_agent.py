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

    async def stream_critique(self, transcript: str, image_data: Optional[str] = None, memory_context: str = "") -> AsyncIterable[str]:
        # Prompt enforces QUESTION first, then REASONING
        system_prompt = (
            "You are an Agentic Critique System. Your task is to analyze user input and optional UI screenshots.\n"
            "MANDATORY OUTPUT FORMAT:\n"
            "QUESTION: [The single most important question to ask next]\n"
            "REASONING: [Your internal reasoning and analysis of the critique]\n\n"
            "Constraints:\n"
            "- Always start with 'QUESTION: '\n"
            "- Internal reasoning must follow 'REASONING: '\n"
            "- Be concise and critical."
        )

        content = [{"type": "text", "text": f"Transcript: {transcript}\nMemory Context: {memory_context}"}]
        
        if image_data:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
            })

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=content)
        ]

        async for chunk in self.llm.astream(messages):
            if chunk.content:
                yield chunk.content
