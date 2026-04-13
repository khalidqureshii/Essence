from enum import Enum, auto
from typing import List, Optional, Tuple
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage

class ResumeConversationState(Enum):
    INITIAL = auto()           
    SKILLS = auto()  
    EXPERIENCE = auto()
    PROJECTS = auto()
    COMPLETED = auto()

class ResumeConversationManager:
    def __init__(self):
        self.history: List[BaseMessage] = []
        self.state = ResumeConversationState.INITIAL
        self.resume_text = ""
        self.focus_mode = "general" # 'general', 'skills', 'projects'
        self.time_limit_mins = 15
        
        # We define rough chunks based on state progression
        self.global_completed_questions = 0
        self.section_progress = 0.0
        
        self.questions_asked_in_current_state = 0
        self.max_questions_per_state = 2 # roughly adaptable based on time_limit

    def setup_interview(self, resume_text: str, focus_mode: str, time_limit_mins: int):
        self.resume_text = resume_text
        self.focus_mode = focus_mode
        self.time_limit_mins = time_limit_mins
        
        if self.focus_mode == "skills":
            self.state = ResumeConversationState.SKILLS
        elif self.focus_mode == "projects":
            self.state = ResumeConversationState.PROJECTS
        else:
            self.state = ResumeConversationState.INITIAL

        # roughly base limit on time (average 3 mins per question set)
        total_questions = max(3, self.time_limit_mins // 2)
        self.max_questions_per_state = max(1, total_questions // 3)

    def update_history(self, user_text: str, ai_text: str):
        if user_text.strip():
            self.history.append(HumanMessage(content=user_text))
        if ai_text.strip():
            self.history.append(AIMessage(content=ai_text))

    def get_state_instruction(self, user_input: str, has_image: bool) -> str:
        """
        Returns the System Prompt instruction AND internal reasoning hints 
        based on the current state.
        """
        base_instruction = (
            "You are an expert HR and Technical Interviewer conducting an automated interview based on the candidate's resume.\n"
            f"Here is the parsed content of their resume:\n<RESUME>\n{self.resume_text}\n</RESUME>\n\n"
            "STRICT CONSTRAINTS:\n"
            "1. Ask EXACTLY ONE question at a time.\n"
            "2. Tailor your questions specifically to the candidate's resume content provided above.\n"
            "3. Do not ask for live demos or screenshots. Assume the interview is purely conversational.\n"
            "4. Keep your responses concise (under 2 sentences unless summarizing).\n"
            "5. Make it feel like a real Viva/HR interview.\n"
        )
        
        state_specific = ""

        if self.state == ResumeConversationState.INITIAL:
            state_specific = (
                "STATE: INITIAL INTRODUCTION\n"
                "- Greet the candidate and ask them to briefly introduce themselves highlighting their background from the resume.\n"
            )
        elif self.state == ResumeConversationState.SKILLS:
            state_specific = (
                "STATE: EVALUATING SKILLS\n"
                "- Pick a specific technical skill or tool mentioned in their resume.\n"
                "- Ask a situational or deep-dive question about their experience with this skill.\n"
                "- Do NOT ask more than one question.\n"
            )
        elif self.state == ResumeConversationState.EXPERIENCE:
            state_specific = (
                "STATE: EVALUATING EXPERIENCE / WORK HISTORY\n"
                "- Ask about a specific past role or responsibility listed in the resume.\n"
                "- Focus on what challenges they faced or what impact they had.\n"
            )
        elif self.state == ResumeConversationState.PROJECTS:
            state_specific = (
                "STATE: EVALUATING PROJECTS\n"
                "- Ask about a specific project they built or participated in, sourced from their resume.\n"
                "- Ask about the technical choices they made or obstacles they overcame.\n"
            )
        elif self.state == ResumeConversationState.COMPLETED:
            state_specific = (
                "STATE: COMPLETED\n"
                "- The interview time is up or all sections are complete.\n"
                "- Summarize briefly, thank the candidate for their time, and explicitly state that the interview is concluded.\n"
            )

        return base_instruction + "\n" + state_specific

    def check_state_transition(self, user_input: str, ai_response: str) -> None:
        """Logic to transition states and update progress."""
        if self.state == ResumeConversationState.COMPLETED:
            return

        self.questions_asked_in_current_state += 1
        self.global_completed_questions += 1
        
        # Update micro progress based on max questions per state
        if self.max_questions_per_state > 0:
            self.section_progress = min(100.0, (self.questions_asked_in_current_state / self.max_questions_per_state) * 100)
        else:
            self.section_progress = 100.0

        if self.questions_asked_in_current_state >= self.max_questions_per_state:
            # Transition to next state depending on flow
            self.questions_asked_in_current_state = 0
            self.section_progress = 0.0
            
            if self.focus_mode == "skills":
                self.state = ResumeConversationState.COMPLETED
            elif self.focus_mode == "projects":
                self.state = ResumeConversationState.COMPLETED
            else:
                # General flow: INITIAL -> SKILLS -> PROJECTS -> EXPERIENCE -> COMPLETED
                if self.state == ResumeConversationState.INITIAL:
                    self.state = ResumeConversationState.SKILLS
                elif self.state == ResumeConversationState.SKILLS:
                    self.state = ResumeConversationState.PROJECTS
                elif self.state == ResumeConversationState.PROJECTS:
                    self.state = ResumeConversationState.EXPERIENCE
                elif self.state == ResumeConversationState.EXPERIENCE:
                    self.state = ResumeConversationState.COMPLETED

    def get_progress_data(self):
        return {
            "macro_completed_chunks": self.global_completed_questions,
            "micro_section_progress": min(round(self.section_progress, 1), 100.0),
            "section": self.state.name,
            "state": self.state.name
        }

    def reset(self):
        self.history = []
        self.state = ResumeConversationState.INITIAL
        self.global_completed_questions = 0
        self.section_progress = 0.0
        self.questions_asked_in_current_state = 0
