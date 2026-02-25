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
        "section": "Project Understanding",
        "questions": [
            "What problem does this project solve, and who is it for?",
            "What exactly did you build to address that problem and what are the main features?"
        ],
        "screenshots_relevant": False
    },
    {
        "section": "UI & User Experience",
        "questions": [
            "Walk me through the application from a user’s perspective.",
            "How does the user interface facilitate the core functionality?"
        ],
        "screenshots_relevant": True
    },
    {
        "section": "Design Decisions & Trade-offs",
        "questions": [
            "What were the major design decisions you made, and what trade-offs did you consider?",
            "Why did you choose your specific tech stack over other alternatives?"
        ],
        "screenshots_relevant": False
    },
    {
        "section": "Technical Awareness",
        "questions": [
            "What happens behind the scenes when a user interacts with the system?",
            "How do you handle data consistency and system performance?"
        ],
        "screenshots_relevant": False
    },
    {
        "section": "Limitations & Improvements",
        "questions": [
            "What are the current limitations of this project, including security or safety concerns?",
            "If you had more time, what would you improve or work on next?"
        ],
        "screenshots_relevant": False
    }
]

class ConversationManager:
    def __init__(self):
        self.history: List[BaseMessage] = []
        self.state = ConversationState.PASSIVE_LISTENING
        self.section_index = -1 # -1 means we haven't started fixed questions yet
        self.question_in_section_index = 0
        self.follow_up_count = 0 
        self.last_ai_question_was_screenshot_prompt = False
        
        # Dual-Layer Progress State
        self.global_completed_questions = 0  # Macro: 0-15 chunks
        self.section_progress = 0.0          # Micro: 0-100% per section
        self.current_section_question_count = 0 # 0-3 internal tracker

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
                self.section_index = 0
                self.question_in_section_index = 0
                self.global_completed_questions = 0
                self.section_progress = 0.0
        
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
            s_info = EVALUATION_QUESTIONS[self.section_index]
            section = s_info["section"]
            questions = s_info["questions"]
            question = questions[self.question_in_section_index]
            
            # Check if we should prompt for screenshots
            if self.should_ask_for_screenshot(user_input):
                 state_specific = (
                     f"STATE: EVALUATION (Section: {section})\n"
                     "The user just provided an answer that mentions visual UI, screens, or outputs.\n"
                     "PROMPT: 'If available, please share relevant screenshots of the output or functionality to better understand the result.'\n"
                     "Do NOT ask the next question yet. Just give this optional prompt and wait.\n"
                 )
            elif self.follow_up_count < 1: # Reduced to 1 follow-up for tighter flow as per requirements
                state_specific = (
                    f"STATE: EVALUATION (Current Scope: {section})\n"
                    f"Current Core Question: \"{question}\"\n\n"
                    "ADAPTIVE FOLLOW-UP MODE:\n"
                    "1. Evaluate if the answer to the previous core question or follow-up needs clarification.\n"
                    "- Is it too high-level or vague?\n"
                    "- Is it missing obvious details implied by the question?\n"
                    "- Is it internally inconsistent or overly abstract?\n"
                    "2. If clarification is needed, ASK A FOLLOW-UP. Keep it short, focused, and concrete.\n"
                    f"3. If the answer is clear, consistent, and specific, ask the current Core Question EXHIBITING THIS EXACT TEXT: \"{question}\"\n"
                    f"4. If you have already asked {self.follow_up_count} follow-up(s), prioritize moving to the core question.\n"
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
                "- You have finished all sections.\n"
                "- Summarize the evaluation briefly and thank the user.\n"
                "- Inform them that they can now generate the full report.\n"
            )

        return base_instruction + "\n" + state_specific

    def should_ask_for_screenshot(self, user_input: str) -> bool:
        """Determines if a screenshot prompt should be shown."""
        if self.section_index < 0 or self.section_index >= len(EVALUATION_QUESTIONS):
            return False
            
        s_info = EVALUATION_QUESTIONS[self.section_index]
        if not s_info["screenshots_relevant"]:
            return False
            
        if self.last_ai_question_was_screenshot_prompt:
            return False

        keywords = ["ui", "interface", "visual", "output", "dashboard", "screen", "result", "chart", "page", "display", "view", "look"]
        user_lower = user_input.lower()
        return any(kw in user_lower for kw in keywords)

    def check_state_transition(self, user_input: str, ai_response: str) -> None:
        """Logic to transition states and update progress."""
        if self.state != ConversationState.EVALUATION:
            return

        ai_lower = ai_response.lower()
        s_info = EVALUATION_QUESTIONS[self.section_index]
        questions = s_info["questions"]
        current_core_q = questions[self.question_in_section_index]
        
        # 1. Screenshot prompt handling
        if "share relevant screenshots" in ai_lower:
            self.last_ai_question_was_screenshot_prompt = True
            return

        # 2. Update Progress (Dual-Layer Model)
        num_q_in_section = len(questions)
        micro_increment = 100.0 / num_q_in_section
        
        normalized_core = self._normalize(current_core_q)
        normalized_ai = self._normalize(ai_lower)

        # We increment progress if we successfully moved past a question (core or follow-up limit)
        did_move_past_question = False

        if normalized_core in normalized_ai:
            did_move_past_question = True
            self.question_in_section_index += 1
            self.follow_up_count = 0
            self.last_ai_question_was_screenshot_prompt = False
        else:
            self.follow_up_count += 1
            self.last_ai_question_was_screenshot_prompt = False
            if self.follow_up_count >= 2: 
                did_move_past_question = True
                self.question_in_section_index += 1
                self.follow_up_count = 0

        if did_move_past_question:
            # Macro Increment
            self.global_completed_questions = min(self.global_completed_questions + 1, 15)
            # Micro Increment
            self.section_progress = min(self.section_progress + micro_increment, 100.0)

        # 3. Section Transition
        if self.question_in_section_index >= len(questions):
            self.section_index += 1
            self.question_in_section_index = 0
            self.follow_up_count = 0
            # Reset Section Progress for new phase
            self.section_progress = 0.0

        if self.section_index >= len(EVALUATION_QUESTIONS):
            self.state = ConversationState.COMPLETED
            self.section_progress = 100.0

    def get_progress_data(self):
        section_name = "N/A"
        if 0 <= self.section_index < len(EVALUATION_QUESTIONS):
            section_name = EVALUATION_QUESTIONS[self.section_index]["section"]
        elif self.state == ConversationState.COMPLETED:
            section_name = "Evaluation Completed"
        elif self.state == ConversationState.PASSIVE_LISTENING:
            section_name = "Project Presentation"
            
        return {
            "macro_completed_chunks": self.global_completed_questions,
            "micro_section_progress": min(round(self.section_progress, 1), 100.0),
            "section": section_name,
            "state": self.state.name
        }

    def reset(self):
        self.history = []
        self.state = ConversationState.PASSIVE_LISTENING
        self.section_index = -1
        self.question_in_section_index = 0
        self.follow_up_count = 0
        self.last_ai_question_was_screenshot_prompt = False
        self.global_completed_questions = 0
        self.section_progress = 0.0
        self.current_section_question_count = 0

