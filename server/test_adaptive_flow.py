from agents.conversation_manager import ConversationManager, ConversationState, EVALUATION_QUESTIONS

def test_adaptive_flow_new():
    cm = ConversationManager()
    
    print(f"Initial State: {cm.state}")
    assert cm.global_completed_questions == 0
    
    # 1. Transition to EVALUATION
    user_input = "basically it"
    instruction = cm.get_state_instruction(user_input, False)
    
    print(f"After '{user_input}': {cm.state}, Section: {cm.section_index}, Q_Index: {cm.question_in_section_index}")
    
    assert cm.state == ConversationState.EVALUATION
    assert cm.section_index == 0
    assert cm.question_in_section_index == 0
    
    # 2. AI asks Core Question 1 of Section 1
    ai_q1 = EVALUATION_QUESTIONS[0]["questions"][0]
    cm.update_history(user_input, ai_q1)
    cm.check_state_transition(user_input, ai_q1)
    
    # Progress: 1 chunk completed, 50% section progress (since Section 1 has 2 questions)
    progress_data = cm.get_progress_data()
    print(f"After Q1: Macro={progress_data['macro_completed_chunks']}, Micro={progress_data['micro_section_progress']}%")
    assert progress_data['macro_completed_chunks'] == 1
    assert progress_data['micro_section_progress'] == 50.0
    
    # 3. User answers Q1, AI asks Follow-up
    user_ans = "Better for internal teams."
    ai_followup = "Which internal teams specifically?"
    cm.update_history(user_ans, ai_followup)
    cm.check_state_transition(user_ans, ai_followup)
    
    # Follow-up shouldn't increase progress yet
    progress_data = cm.get_progress_data()
    assert progress_data['macro_completed_chunks'] == 1
    assert progress_data['micro_section_progress'] == 50.0
    
    # 4. User answers follow-up, AI repeats/asks Core Question 2
    # Moving past Core Q2
    user_ans_2 = "Engineering teams."
    ai_q2 = EVALUATION_QUESTIONS[0]["questions"][1]
    cm.update_history(user_ans_2, ai_q2)
    cm.check_state_transition(user_ans_2, ai_q2)
    
    # Now chunk 2 should be green, and section progress for Section 1 should be 100% 
    # (Actually it resets to 0% when transitioning to next section)
    progress_data = cm.get_progress_data()
    print(f"After Q2: Macro={progress_data['macro_completed_chunks']}, Micro={progress_data['micro_section_progress']}% (Transitioned)")
    assert progress_data['macro_completed_chunks'] == 2
    assert progress_data['micro_section_progress'] == 0.0 # Resets on section transition
    assert progress_data['section'] == "UI & User Experience"
    
    # 5. Fast forward to end of Section 2
    # Section 2: UI & User Experience (2 questions)
    q_ui_1 = EVALUATION_QUESTIONS[1]["questions"][0]
    cm.update_history("User answer", q_ui_1)
    cm.check_state_transition("User answer", q_ui_1)
    
    # Macro = 3, Micro = 50%
    assert cm.get_progress_data()['macro_completed_chunks'] == 3
    assert cm.get_progress_data()['micro_section_progress'] == 50.0
    
    # Finishing Section 2
    q_ui_2 = EVALUATION_QUESTIONS[1]["questions"][1]
    cm.update_history("User answer", q_ui_2)
    cm.check_state_transition("User answer", q_ui_2)
    
    # Macro = 4, Micro = 0.0% (Reset for Section 3)
    assert cm.get_progress_data()['macro_completed_chunks'] == 4
    assert cm.section_index == 2
    assert cm.get_progress_data()['section'] == "Design Decisions & Trade-offs"

    print("\nALL DUAL-LAYER PROGRESS TESTS PASSED")

if __name__ == "__main__":
    test_adaptive_flow_new()
