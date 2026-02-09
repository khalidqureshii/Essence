import asyncio
from agents.conversation_manager import ConversationManager, ConversationState, EVALUATION_QUESTIONS

def test_adaptive_flow():
    cm = ConversationManager()
    
    print(f"Initial State: {cm.state}")
    
    # 1. Transition to EVALUATION
    user_input = "basically it"
    instruction = cm.get_state_instruction(user_input, False)
    # Simulator: update history as orchestrator would
    # In real flow, orchestrator calls get_state_instruction, then ThinkingAgent, then updates history
    
    # Transition happens in get_state_instruction for PASSIVE -> EVALUATION
    print(f"After '{user_input}': {cm.state}, Q_Index: {cm.question_index}")
    
    assert cm.state == ConversationState.EVALUATION
    assert cm.question_index == 0
    
    # 2. AI asks Core Question 1
    ai_q1 = EVALUATION_QUESTIONS[0]["question"]
    cm.update_history(user_input, ai_q1)
    cm.check_state_transition(user_input, ai_q1)
    
    print(f"After AI asks Q1: State={cm.state}, Q_Index={cm.question_index}, Follow-ups={cm.follow_up_count}")
    assert cm.question_index == 1
    assert cm.follow_up_count == 0
    
    # 3. User answers Q1 vaguely
    user_ans = "I built a tool for devs."
    # AI decides to ask a follow-up
    ai_followup_1 = "Can you be more specific about what devs and what tool?"
    
    cm.update_history(user_ans, ai_followup_1)
    cm.check_state_transition(user_ans, ai_followup_1)
    
    print(f"After AI asks Follow-up 1: State={cm.state}, Q_Index={cm.question_index}, Follow-ups={cm.follow_up_count}")
    assert cm.question_index == 1
    assert cm.follow_up_count == 1
    
    # 4. User answers follow-up 1
    user_ans_2 = "Web devs, for tracking logs."
    # AI asks another follow-up
    ai_followup_2 = "Which part of the logs does it track?"
    
    cm.update_history(user_ans_2, ai_followup_2)
    cm.check_state_transition(user_ans_2, ai_followup_2)
    
    print(f"After AI asks Follow-up 2: State={cm.state}, Q_Index={cm.question_index}, Follow-ups={cm.follow_up_count}")
    assert cm.question_index == 1
    assert cm.follow_up_count == 2
    
    # 5. User answers follow-up 2
    user_ans_3 = "The runtime errors."
    # AI should now ask Core Question 2 (even if it wants more, count is 2)
    ai_q2 = EVALUATION_QUESTIONS[1]["question"]
    
    cm.update_history(user_ans_3, ai_q2)
    cm.check_state_transition(user_ans_3, ai_q2)
    
    print(f"After AI asks Q2: State={cm.state}, Q_Index={cm.question_index}, Follow-ups={cm.follow_up_count}")
    assert cm.question_index == 2
    assert cm.follow_up_count == 0
    
    # 6. Test direct core question (clear answer)
    user_ans_4 = "It uses Python and React."
    ai_q3 = EVALUATION_QUESTIONS[2]["question"]
    
    cm.update_history(user_ans_4, ai_q3)
    cm.check_state_transition(user_ans_4, ai_q3)
    
    print(f"After AI asks Q3: State={cm.state}, Q_Index={cm.question_index}, Follow-ups={cm.follow_up_count}")
    assert cm.question_index == 3
    assert cm.follow_up_count == 0

    print("\nTEST PASSED")

if __name__ == "__main__":
    test_adaptive_flow()
