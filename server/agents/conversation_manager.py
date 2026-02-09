from enum import Enum, auto
from typing import List, Optional, Tuple
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

class ConversationState(Enum):
    INITIAL_GREETING = auto()    # Bot says hi
    PASSIVE_LISTENING = auto()   # User explains the project
    EVALUATION = auto()          # Asking the 10 fixed questions
    COMPLETED = auto()           # All questions answered

EVALUATION_QUESTIONS = [
    {
        "section": "Problem Understanding & Intent",
        "question": "What problem does this project solve, and who is it for?",
        "screenshots_relevant": False
    },
    {
        "section": "Problem Understanding & Intent",
        "question": "What exactly did you build to address that problem and what are the main features?",
        "screenshots_relevant": False
    },
    {
        "section": "Application Flow & System Thinking",
        "question": "Walk me through the application from a user’s perspective.",
        "screenshots_relevant": False
    },
    {
        "section": "Application Flow & System Thinking",
        "question": "What happens behind the scenes when the user interacts with it?",
        "screenshots_relevant": False
    },
    {
        "section": "Technical Approach & Stack",
        "question": "What technical approach and tech stack did you choose, and why?",
        "screenshots_relevant": False
    },
    {
        "section": "Technical Approach & Stack",
        "question": "What alternatives (tools, frameworks, or architectures) did you consider, and why didn’t you choose them?",
        "screenshots_relevant": False
    },
    {
        "section": "Functionality, Outputs & Quality",
        "question": "Does the core functionality work end-to-end as intended?",
        "screenshots_relevant": True
    },
    {
        "section": "Functionality, Outputs & Quality",
        "question": "What are the concrete outputs or results, and how do they tie back to the project’s goal?",
        "screenshots_relevant": True
    },
    {
        "section": "Trade-offs, Security & Maturity",
        "question": "What trade-offs or limitations exist in this design, including security or safety concerns if relevant?",
        "screenshots_relevant": False
    },
    {
        "section": "Trade-offs, Security & Maturity",
        "question": "If you had more time, what would you improve or work on next?",
        "screenshots_relevant": False
    }
]

class ConversationManager:
    def __init__(self):
        self.history: List[BaseMessage] = []
        self.state = ConversationState.PASSIVE_LISTENING
        self.question_index = -1 # -1 means we haven't started fixed questions yet
        self.follow_up_count = 0 
        self.last_ai_question_was_screenshot_prompt = False

    def update_history(self, user_text: str, ai_text: str):
        self.history.append(HumanMessage(content=user_text))
        self.history.append(AIMessage(content=ai_text))

    def _normalize(self, text: str) -> str:
        import string
        lowered = text.lower()
        # Remove punctuation
        no_punct = "".join(char for char in lowered if char not in string.punctuation)
        # Normalize whitespace
        return " ".join(no_punct.split())

    def get_state_instruction(self, user_input: str, has_image: bool) -> str:
        """
        Returns the System Prompt instruction AND internal reasoning hints 
        based on the current state.
        """
        
        # Check for state transitions BEFORE generating instructions
        # This ensures the AI asks the first question immediately when user is done explaining
        if self.state == ConversationState.PASSIVE_LISTENING:
            trigger_phrases = [
                "that's it", "that is it", "that's all", "that is all",
                "done explaining", "finished explaining", 
                "what do you think", "ready for questions",
                "basically it", "started"
            ]
            user_lower = user_input.lower()
            if any(phrase in user_lower for phrase in trigger_phrases):
                self.state = ConversationState.EVALUATION
                self.question_index = 0
        
        base_instruction = (
            "You are Essence, an expert Technical Interviewer and Examiner.\n"
            "Your goal is to EVALUATE the user's knowledge of the hosted project they are showing via screenshots.\n"
            "Do NOT act as a coding assistant. Do NOT offer to write code.\n"
            "Act like a professor or senior engineer conducting a Viva Voce.\n\n"
            "STRICT CONSTRAINTS:\n"
            "1. NEVER request a live demo or a project URL/Link. Only ask for screenshots of the live, hosted project.\n"
            "2. NEVER request to see the source code or ask questions about specific implementation code details.\n"
            "3. FOCUS your evaluation on the live project's architecture, user flows, and high-level logic based on the screenshots.\n"
            "4. Ask **ONLY ONE** question at a time. Never ask a second question or 'Also' in the same turn.\n"
            "5. Keep your responses concise (under 2 sentences unless summarizing).\n"
            "6. Once you ask a question, STOP. Wait for the user to answer.\n"
        )
        
        state_specific = ""

        if self.state == ConversationState.PASSIVE_LISTENING:
            state_specific = (
                "STATE: PASSIVE_LISTENING (User is presenting)\n"
                "- The user is explaining their project.\n"
                "- LISTEN ACTIVELY. Do not interrupt with questions yet.\n"
                "- Reply with short acknowledgments (e.g., 'I see', 'Okay', 'Go on').\n"
                "- If the user indicates they are done (e.g., 'That's it', 'Ready'), "
                "briefly acknowledge and say you will now start the evaluation.\n"
            )

        elif self.state == ConversationState.EVALUATION:
            q_info = EVALUATION_QUESTIONS[self.question_index]
            section = q_info["section"]
            question = q_info["question"]
            
            # Check if we should prompt for screenshots
            if self.should_ask_for_screenshot(user_input):
                 state_specific = (
                     f"STATE: EVALUATION (Question {self.question_index + 1}: {section})\n"
                     "The user just provided an answer that mentions visual UI, screens, or outputs.\n"
                     "PROMPT: 'If available, please share relevant screenshots of the output or functionality to better understand the result.'\n"
                     "Do NOT ask the next question yet. Just give this optional prompt and wait.\n"
                 )
            elif self.question_index > 0 and self.follow_up_count < 2:
                prev_q = EVALUATION_QUESTIONS[self.question_index - 1]["question"]
                state_specific = (
                    f"STATE: EVALUATION (Current Scope: {section})\n"
                    f"The user just answered: \"{prev_q}\"\n"
                    f"Next Core Question: \"{question}\"\n\n"
                    "ADAPTIVE FOLLOW-UP MODE:\n"
                    "1. Evaluate if the answer to the previous core question needs clarification.\n"
                    "- Is it too high-level or vague?\n"
                    "- Is it missing obvious details implied by the question?\n"
                    "- Is it internally inconsistent or overly abstract (buzzwords without specifics)?\n"
                    "2. If clarification is needed, ASK A FOLLOW-UP. Keep it short, focused, and concrete.\n"
                    f"3. If the answer is clear, consistent, and specific, ask the next Core Question EXHIBITING THIS EXACT TEXT: \"{question}\"\n"
                    f"4. If you have already asked {self.follow_up_count} follow-up(s) for the previous question, prioritize moving to the core question unless absolutely necessary to clarify.\n"
                )
            else:
                state_specific = (
                    f"STATE: EVALUATION (Section: {section})\n"
                    f"ASK THIS EXACT CORE QUESTION: \"{question}\"\n"
                    "- Do NOT vary the wording significantly.\n"
                    "- Do NOT ask any other question.\n"
                )

        elif self.state == ConversationState.COMPLETED:
            state_specific = (
                "STATE: COMPLETED\n"
                "- You have finished all 10 questions.\n"
                "- Summarize the evaluation briefly and thank the user.\n"
                "- Inform them that they can now generate the full report.\n"
            )

        return base_instruction + "\n" + state_specific

    def should_ask_for_screenshot(self, user_input: str) -> bool:
        """Determines if a screenshot prompt should be shown based on user input and current question."""
        if self.question_index < 0 or self.question_index >= len(EVALUATION_QUESTIONS):
            return False
            
        q_info = EVALUATION_QUESTIONS[self.question_index]
        if not q_info["screenshots_relevant"]:
            return False
            
        # Also ensure we haven't JUST asked it
        if self.last_ai_question_was_screenshot_prompt:
            return False

        keywords = [
            "ui", "interface", "visual", "output", "dashboard", "screen", 
            "result", "chart", "page", "display", "view", "look", "appearance"
        ]
        user_lower = user_input.lower()
        return any(kw in user_lower for kw in keywords)

    def check_state_transition(self, user_input: str, ai_response: str) -> None:
        """
        Logic to transition states based on the last interaction.
        """
        user_lower = user_input.lower()
        ai_lower = ai_response.lower()

        # EVALUATION Transitions (STATE transition from PASSIVE happens in get_state_instruction now)
        if self.state == ConversationState.EVALUATION:
            # 1. Screenshot prompt handling
            if "share relevant screenshots" in ai_lower:
                self.last_ai_question_was_screenshot_prompt = True
                return # Stay on same question, wait for answer/image
            
            # 2. Core Question Detection (Normalized)
            current_core_q = EVALUATION_QUESTIONS[self.question_index]["question"]
            normalized_core = self._normalize(current_core_q)
            normalized_ai = self._normalize(ai_lower)

            if normalized_core in normalized_ai:
                self.question_index += 1
                self.follow_up_count = 0
                self.last_ai_question_was_screenshot_prompt = False
            else:
                # 3. Follow-up detected or core question misidentified
                self.follow_up_count += 1
                self.last_ai_question_was_screenshot_prompt = False
                
                # HARD LIMIT: If we've asked 2 follow-ups, force move to next core question
                # after the next user response (i.e., AI will be prompted for next core question now).
                if self.follow_up_count >= 2:
                    self.question_index += 1
                    self.follow_up_count = 0

            if self.question_index >= len(EVALUATION_QUESTIONS):
                self.state = ConversationState.COMPLETED

    def reset(self):
        self.history = []
        self.state = ConversationState.PASSIVE_LISTENING
        self.question_index = -1
        self.follow_up_count = 0
        self.last_ai_question_was_screenshot_prompt = False

