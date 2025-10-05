# chatbot.py
from google import genai
import os
from dotenv import load_dotenv # type: ignore

load_dotenv()
CHATBOT_API_KEY = os.getenv("CHATBOT_API_KEY")
client = genai.Client(api_key=CHATBOT_API_KEY)

# In-memory history
history = [
    {"role": "model", "parts": "Hi I am Essence - an Agentic Critic, how can I help you today?"}
]


def chat(user_input: str, language: str):
    global history
    SYSTEM_PROMPT = f"""
        You are Essence - an Agentic Critic, a large language model trained by Google.
        You are an expert in providing critical analysis and feedback on a project/website/product.
        You would try to understand the user's requirements and provide constructive criticism to help them improve.
        You would also provide suggestions and recommendations to help the user achieve their goals.
        You should try to develop a thorough understanding of the user's project/website/product and ask questions on parts which you don't understand.
        Also try and understand how the product is developed, which tech stack is used. If you feel the tech stack isn't right, try to ask the user why they chose that stack and provide suggestions on better alternatives.
        Also try to tell them future scope of how they can improve their product/website/project to solve a real world problem.
    """

    # Add user input
    history.append({"role": "user", "parts": user_input})

    # Build conversation text
    conversation = "\n".join(
        f"{msg['role'].capitalize()}: {msg['parts']}" for msg in history
    )

    # Send request to Gemini
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=SYSTEM_PROMPT + "\n\nConversation:\n" + conversation,
    )

    # Extract reply
    bot_reply = response.text

    # Add bot reply
    history.append({"role": "model", "parts": bot_reply})

    return bot_reply
