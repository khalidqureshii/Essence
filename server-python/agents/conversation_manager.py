from enum import Enum, auto
from typing import List, Optional, Tuple
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

class ConversationState(Enum):
    PASSIVE_LISTENING = auto()   # User is explaining, we just listen/acknowledge
    ALIGNMENT = auto()           # User finished explaining, we summarize & confirm
    KNOWLEDGE_GATHERING = auto() # Evaluator asks foundational questions
    CROSS_QUESTIONING = auto()   # Evaluator drills down / cross-examines
    SATISFACTION_CHECK = auto()  # Check if user wants to continue or exit

class ConversationManager:
    def __init__(self):
        self.history: List[BaseMessage] = []
        self.state = ConversationState.PASSIVE_LISTENING
        # We can track topic depth or satisfaction count if needed
        self.topic_depth = 0 

    def update_history(self, user_text: str, ai_text: str):
        self.history.append(HumanMessage(content=user_text))
        self.history.append(AIMessage(content=ai_text))
        # Keep history manageable? For now, let's keep all for context.

    def get_state_instruction(self, user_input: str, has_image: bool) -> str:
        """
        Returns the System Prompt instruction AND internal reasoning hints 
        based on the current state.
        """
        
        base_instruction = (
            "You are Essence, an expert Technical Interviewer and Examiner.\n"
            "Your goal is to EVALUATE the user's knowledge of the project they are showing.\n"
            "Do NOT act as a coding assistant. Do NOT offer to write code.\n"
            "Act like a professor or senior engineer conducting a Viva Voce.\n\n"
            "CRITICAL RULES:\n"
            "1. Ask **ONLY ONE** question at a time. Never ask a second question in the same turn.\n"
            "2. Do NOT tack on 'Also, ...' or 'And one more thing...' questions.\n"
            "3. Keep your responses concise (under 3 sentences unless summarizing).\n"
            "4. Once you ask a question, STOP. Wait for the user to answer.\n"
        )
        
        state_specific = ""

        if self.state == ConversationState.PASSIVE_LISTENING:
            if has_image:
                state_specific = (
                    "STATE: PASSIVE_LISTENING (User is presenting)\n"
                    "- The user is showing you their code or project.\n"
                    "- LISTEN ACTIVELY. Do not interrupt with questions yet.\n"
                    "- If the user is still explaining, reply with short acknowledgments (e.g., 'I see', 'Okay', 'Go on').\n"
                    "- internally note down goals, features, and gaps.\n"
                    "- ONLY if the user explicitly indicates they are done explaining (e.g., 'That's it', 'What do you think?'), \n"
                    "  switch to summarizing their project.\n"
                    "- Output format: Just a normal conversational response.\n"
                )
            else:
                # Fallback if no image but maybe just talking?
                state_specific = (
                     "STATE: PASSIVE_LISTENING (Waiting for context)\n"
                     "- The user hasn't shared a screen yet or is just talking.\n"
                     "- Encourage them to show the project or explain more.\n"
                )

        elif self.state == ConversationState.ALIGNMENT:
            state_specific = (
                "STATE: ALIGNMENT (Confirming Understanding)\n"
                "- Provide a brief 1-2 sentence summary of what your understood about their project.\n"
                "- Ask the user to confirm if this understanding is correct.\n"
                "- Do NOT ask technical questions yet.\n"
                "- If you must clarify something, ask ONE simple question.\n"
            )

        elif self.state == ConversationState.KNOWLEDGE_GATHERING:
            state_specific = (
                "STATE: KNOWLEDGE_GATHERING (Foundational Questions)\n"
                "- Ask EXACTLY ONE foundational question about the problem statement, users, or core features.\n"
                "- Keep the tone neutral and non-challenging.\n"
                "- Do NOT ask multiple questions. Ask one question and wait for the answer.\n"
            )

        elif self.state == ConversationState.CROSS_QUESTIONING:
            state_specific = (
                "STATE: CROSS_QUESTIONING (Deep Dive)\n"
                "- Evaluate the user's previous answer.\n"
                "- IF response was clear: Move to a new related topic.\n"
                "- IF response was vague/partial: Ask a follow-up or challenge an assumption.\n"
                "- IF response indicated a gap: Ask about edge cases or trade-offs.\n"
                "- Ask EXACTLY ONE focused question only. Do NOT double-barrel questions.\n"
            )

        elif self.state == ConversationState.SATISFACTION_CHECK:
            state_specific = (
                "STATE: SATISFACTION_CHECK\n"
                "- Ask: 'Are you satisfied with the depth of questions so far?'\n"
                "- If they say yes, summarize insights.\n"
                "- If no, or they want more, acknowledge and ask what topic to cover next.\n"
            )

        return base_instruction + "\n" + state_specific

    def check_state_transition(self, user_input: str, ai_response: str) -> None:
        """
        Heuristic or Logic to transition states based on the last interaction.
        This is called AFTER the AI has generated a response.
        """
        user_lower = user_input.lower()
        ai_lower = ai_response.lower()

        # PASSIVE -> ALIGNMENT
        if self.state == ConversationState.PASSIVE_LISTENING:
            trigger_phrases = [
                "that's it", "that is it", "that's all", "that is all",
                "done explaining", "finished explaining", 
                "what do you think", "ready for questions",
                "basically it", "started" # "started"? Maybe not.
            ]
            
            # Check for exact phrase matches or strong keywords
            if any(phrase in user_lower for phrase in trigger_phrases):
                self.state = ConversationState.ALIGNMENT
                
        # ALIGNMENT -> KNOWLEDGE_GATHERING
        elif self.state == ConversationState.ALIGNMENT:
            # If user confirms "Yes", "Correct", "Right"
            if any(word in user_lower for word in ["yes", "correct", "right", "yeah", "exactly", "sure", "ok"]):
                self.state = ConversationState.KNOWLEDGE_GATHERING
            # If user corrects, we might stay in ALIGNMENT or go back to PASSIVE? 
            # Let's stay in ALIGNMENT (re-summarize) if they say "No".

        # KNOWLEDGE_GATHERING -> CROSS_QUESTIONING
        elif self.state == ConversationState.KNOWLEDGE_GATHERING:
            # After asking one foundation question and getting an answer, we go to cross questioning
            if len(self.history) > 2: # At least one QA pair
                self.state = ConversationState.CROSS_QUESTIONING
                self.topic_depth = 0 # Reset counter

        # CROSS_QUESTIONING -> SATISFACTION_CHECK
        elif self.state == ConversationState.CROSS_QUESTIONING:
            self.topic_depth += 1
            
            # Logic: Periodically check (every 4 turns) OR if user asks to stop
            if self.topic_depth >= 4 or any(word in user_lower for word in ["enough", "stop", "satisfied", "done"]):
                self.state = ConversationState.SATISFACTION_CHECK
                self.topic_depth = 0
            
            # Or every N turns?
            # Let's keep it simple: User must trigger exit or we just loop.
            # Constraint 5: "Periodically (not after every question), Essence should offer control"
            # We can handle this by injecting a prompt instruction "Occasionally ask if they want to continue".
            pass

        # SATISFACTION -> ?
        elif self.state == ConversationState.SATISFACTION_CHECK:
            if "yes" in user_lower:
                # Reset or End?
                self.state = ConversationState.PASSIVE_LISTENING # Reset for new topic?
                self.history = [] # Clear history?
            elif "no" in user_lower:
                 self.state = ConversationState.CROSS_QUESTIONING

    def reset(self):
        self.history = []
        self.state = ConversationState.PASSIVE_LISTENING
