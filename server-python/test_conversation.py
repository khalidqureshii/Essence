import asyncio
import sys
from agents.conversation_manager import ConversationManager, ConversationState

async def test_flow():
    cm = ConversationManager()
    
    print(f"Start State: {cm.state}")
    
    # 1. Simulate Passive Listening
    user_input = "Here is my login code."
    ai_response = "Okay."
    cm.update_history(user_input, ai_response)
    cm.check_state_transition(user_input, ai_response)
    print(f"After 'Here is code': {cm.state}")
    
    # 2. Simulate User Finishing
    user_input = "That's basically it for the auth flow."
    ai_response = "Summary..."
    cm.update_history(user_input, ai_response)
    cm.check_state_transition(user_input, ai_response)
    print(f"After 'That's basically it': {cm.state}")
    
    if cm.state != ConversationState.ALIGNMENT:
        print("FAIL: Expected ALIGNMENT")
    
    # 3. Simulate Alignment Confirmation
    user_input = "Yes, exactly."
    ai_response = "Question 1?" 
    cm.update_history(user_input, ai_response)
    cm.check_state_transition(user_input, ai_response)
    print(f"After 'Yes, exactly': {cm.state}")

    if cm.state != ConversationState.KNOWLEDGE_GATHERING:
        print("FAIL: Expected KNOWLEDGE_GATHERING")
        
    # 4. Simulate Knowledge Gathering Answer
    user_input = "The users are internal admins."
    ai_response = "Question 2?"
    cm.update_history(user_input, ai_response)
    cm.check_state_transition(user_input, ai_response)
    print(f"After 'Users are...': {cm.state}")
    
    # Check if we moved to Cross Questioning
    # History length is now: 2 (Passive) + 2 (Align) + 2 (Yes) + 2 (Users) = 8.
    # Logic: if len > 2 -> CrossQuestioning.
    if cm.state != ConversationState.CROSS_QUESTIONING:
        print(f"FAIL: Expected CROSS_QUESTIONING, got {cm.state}")
        print(f"History len: {len(cm.history)}")

if __name__ == "__main__":
    asyncio.run(test_flow())
