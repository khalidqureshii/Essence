import asyncio
import string
from agents.conversation_manager import ConversationManager, ConversationState, EVALUATION_QUESTIONS

def test_repro():
    cm = ConversationManager()
    cm.state = ConversationState.EVALUATION
    cm.question_index = 1 # We just finished Q0
    cm.follow_up_count = 0
    
    # Q1 is index 1
    q1_text = EVALUATION_QUESTIONS[1]["question"]
    print(f"Target Q1: {q1_text}")
    
    # Simulation 1: AI asks Q1 but with a period instead of question mark
    ai_response = q1_text.replace("?", ".")
    print(f"\n1. AI Response (rephrased punctuation): {ai_response}")
    
    cm.check_state_transition("dummy", ai_response)
    print(f"   Status: Q_Index={cm.question_index}, Follow_ups={cm.follow_up_count}")
    
    if cm.question_index == 1:
        print("   -> REPRODUCED: Manager failed to detect core question due to punctuation change.")
    else:
        print("   -> PASSED: Manager detected core question.")

    # Simulation 2: AI continues asking follow-ups beyond 2
    print("\n2. Simulating multiple follow-ups...")
    cm.follow_up_count = 0 # Reset for test
    cm.check_state_transition("dummy", "follow up 1")
    cm.check_state_transition("dummy", "follow up 2")
    cm.check_state_transition("dummy", "follow up 3")
    cm.check_state_transition("dummy", "follow up 4")
    print(f"   Follow-ups count: {cm.follow_up_count}")
    if cm.follow_up_count > 2:
        print("   -> REPRODUCED: Follow-up count exceeded 2 without moving on.")
    else:
        print("   -> PASSED: Follow-up count capped or moved on.")

if __name__ == "__main__":
    test_repro()
