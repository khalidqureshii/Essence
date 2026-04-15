import logging
import json
from google import genai
from config import Config

logger = logging.getLogger("ReportAgent")

class ReportAgent:
    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name
        self.client = None
        
        if self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
                logger.info(f"ReportAgent initialized with model: {self.model_name}")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
        else:
            logger.warning("ReportAgent initialized without API key. Report generation will fail.")

    async def generate_project_report(self, chat_history: list) -> str:
        print("Reached Here")
        if not self.client:
            return "Error: Gemini API key not configured."

        if not chat_history:
            return "Error: No chat history provided."

        try:
            # Format chat history for context
            formatted_history = ""
            for msg in chat_history:
                role = msg.get("role", "unknown")
                content = msg.get("content", "")
                formatted_history += f"{role}: {content}\n"

            prompt = f"""
            You are an expert software project evaluator.

            Your task is to generate a structured evaluation report about a software project based on the information provided, including the conversation text and visual evidence from screenshots shared during the session.

            Conversation History (Role: Content):
            {formatted_history}

            IMPORTANT RULES:
            - Evaluate ONLY the PROJECT, not the person who built it.
            - Be objective, analytical, and professional in tone.
            - Do NOT invent features or assumptions that were not mentioned.
            - If information is insufficient for a parameter, reduce confidence in scoring and mention the limitation in the feedback.
            - All scores must be out of 100.
            - Keep feedback concise but meaningful (2–4 sentences per parameter).

            Evaluate the project using the following parameters:

            1. Problem Relevance – How meaningful and well-defined is the problem the project aims to solve?
            2. Solution Effectiveness – How effectively does the implemented solution addresses the stated problem?
            3. Technical Architecture Quality – How well-structured and logically designed is the system architecture?
            4. Technology Stack Appropriateness – How suitable are the chosen technologies for the project’s goals and scale?
            5. Feature Completeness – Are the core and supporting features fully implemented as expected?
            6. Innovation & Uniqueness – Does the project demonstrate originality or creative problem-solving?
            7. Functionality & Stability – Does the system operate reliably under normal usage conditions?
            8. Error Handling & Edge Case Coverage – How well does the project manage invalid inputs, failures, and uncommon scenarios?
            9. Scalability Potential – Can the system be extended to handle growth in users, data, or features?
            10. Performance Efficiency – Are performance and resource usage reasonably optimized?
            11. Integration Quality – How well do different components (frontend, backend, APIs, external services) work together?
            12. Limitations & Future Scope Awareness – Does the project clearly acknowledge current limitations and possible future improvements?
            13. Overall Project Maturity – How polished, complete, and production-like does the project feel overall?

            After evaluating all parameters, also provide:

            • Strengths (maximum 3 bullet points)
            • Areas to Improve (maximum 3 bullet points)
            • Recommendations (maximum 3 bullet points)

            Then provide actionable next steps grouped into exactly three categories:
            1. Priority Fixes (urgent technical or structural issues)
            2. Short-Term Goals (improvements that can be done with moderate effort)
            3. Long-Term Goals (future enhancements, scaling, or advanced improvements)

            STRICT OUTPUT FORMAT:
            Return ONLY valid JSON. Do not include explanations outside JSON.

            {{
              "overall_score": 1-100,
              "evaluation": [
                {{
                  "parameter": "Problem Relevance",
                  "score": 0,
                  "feedback": ""
                }}
              ],
              "strengths": [],
              "areas_to_improve": [],
              "recommendations": [],
              "next_steps": {{
                "priority_fixes": "",
                "short_term_goals": "",
                "long_term_goals": ""
              }},
              "overall_summary": ""
            }}

            SCORING GUIDELINES:
            90–100 = Excellent, production-level quality  
            75–89  = Strong but with notable improvement areas  
            60–74  = Functional but lacking depth or robustness  
            40–59  = Major gaps in design or implementation  
            Below 40 = Very early-stage or poorly defined project  

            The "overall_summary" should be a professional 4–6 sentence summary of the project’s overall quality, maturity, and readiness level.
            """


            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            
            logger.info("Raw LLM response received")
            print("="*50)
            print("RAW RESPONSE:")
            print(response.text)
            print("="*50)
            
            # Parse and validate JSON
            response_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith('```json'):
                response_text = response_text.replace('```json', '', 1)
                response_text = response_text.rsplit('```', 1)[0]
            elif response_text.startswith('```'):
                response_text = response_text.replace('```', '', 1)
                response_text = response_text.rsplit('```', 1)[0]
            
            response_text = response_text.strip()
            
            # Validate it's valid JSON
            try:
                parsed_json = json.loads(response_text)
                logger.info("✅ Successfully parsed JSON response")
                print("PARSED JSON STRUCTURE:")
                print(json.dumps(parsed_json, indent=2)[:500] + "...")
                return parsed_json  # Return as dict, not string
            except json.JSONDecodeError as je:
                logger.error(f"❌ Failed to parse LLM response as JSON: {je}")
                print(f"INVALID JSON: {response_text[:200]}")
                return {
                    "error": "LLM returned invalid JSON",
                    "raw_response": response_text[:500]
                }

        except Exception as e:
            logger.error(f"Error generating project report: {e}")
            return {"error": f"Error generating project report: {str(e)}"}

    def _build_fallback_report(self, interview_type: str, duration_str: str, is_short: bool) -> dict:
        """Builds a minimal but valid report structure when the LLM fails or data is insufficient."""
        disclaimer = (
            "This interview was very short, so the evaluation is based on limited data. "
            "For more accurate and detailed feedback, please attempt a longer interview (15+ minutes)."
        ) if is_short else "Report generated with available data."

        return {
            "meta": {
                "interview_type": interview_type,
                "duration": duration_str,
                "mode": "chat",
                "generated_at": "N/A",
                "disclaimer": disclaimer
            },
            "scorecard": {
                "overall_score": 40 if is_short else 50,
                "dimensions": [
                    {"name": "Communication", "score": 45, "weight": 0.25, "summary": "Insufficient data to fully evaluate communication skills."},
                    {"name": "Self-Awareness", "score": 40, "weight": 0.20, "summary": "Limited responses made it difficult to gauge self-awareness."},
                    {"name": "Confidence", "score": 50, "weight": 0.20, "summary": "The candidate participated but the session was too brief for a reliable reading."},
                    {"name": "Storytelling", "score": 35, "weight": 0.15, "summary": "Not enough conversational depth to assess narrative ability."},
                    {"name": "Cultural Fit", "score": 40, "weight": 0.20, "summary": "More interaction needed to determine cultural alignment."}
                ]
            },
            "section_breakdown": [],
            "per_question_analysis": [],
            "resume_consistency": {
                "consistent_points": [],
                "discrepancies": [],
                "unexplored_resume_strengths": ["Most resume strengths were not explored due to the short duration."]
            },
            "communication_metrics": {
                "response_length_quality": "insufficient",
                "structured_thinking_score": 30,
                "active_listening_score": 40
            },
            "strengths": [
                {"title": "Willingness to Participate", "evidence": "The candidate engaged with the interview process despite the short timeframe."}
            ],
            "improvement_areas": [
                {"title": "Provide More Detail", "issue": "Responses were too brief to demonstrate depth.", "actionable_tip": "Practice elaborating on your experiences using the STAR method (Situation, Task, Action, Result)."},
                {"title": "Attempt Longer Sessions", "issue": "A 1-minute interview is insufficient for meaningful evaluation.", "actionable_tip": "Try a 5 or 15-minute session for a comprehensive assessment."}
            ],
            "suggested_followups": [],
            "readiness_verdict": {
                "status": "needs_practice",
                "label": "Insufficient Data",
                "summary": disclaimer,
                "next_step": "Retake the interview with a longer time limit (at least 5 minutes) for an accurate evaluation."
            },
            "prep_plan": None
        }

    async def generate_interview_report(self, chat_history: list, resume_text: str, interview_type: str, duration_mins: int) -> dict:
        if not self.client:
            return {"error": "Error: Gemini API key not configured."}

        # Count actual user messages (not system or bot setup messages)
        user_messages = [m for m in chat_history if m.get("role") == "user" and not m.get("content", "").startswith("[System]")]
        is_short_interview = len(user_messages) < 3 or duration_mins <= 1

        if not chat_history or len(chat_history) < 2:
            logger.warning("Very minimal chat history — returning fallback report")
            duration_str = "5min" if duration_mins <= 5 else ("15min" if duration_mins <= 15 else "60min")
            return self._build_fallback_report(interview_type, duration_str, is_short=True)

        # Format duration string as expected by prompt
        if duration_mins <= 5:
            duration_str = "5min"
        elif duration_mins <= 15:
            duration_str = "15min"
        else:
            duration_str = "60min"

        # Add data-sufficiency notice for short interviews
        data_notice = ""
        if is_short_interview:
            data_notice = (
                "\n# IMPORTANT: SHORT INTERVIEW NOTICE\n"
                "This interview was very brief with limited data. You MUST still generate a complete, valid JSON report.\n"
                "- Scores should reflect the limited evidence (expect lower scores, typically 30-55 range).\n"
                "- In the readiness_verdict.summary, include a note that the interview was too short for a fully accurate assessment.\n"
                "- Still fill in ALL required fields — use reasonable inferences from the resume where direct interview evidence is missing.\n"
                "- Do NOT return an error or refuse. Always produce a valid report.\n"
            )

        try:
            formatted_history = ""
            for msg in chat_history:
                role = msg.get("role", "unknown")
                content = msg.get("content", "")
                formatted_history += f"[{role.upper()}]: {content}\n"

            prompt = f"""
# ROLE
You are an expert interview evaluator and career coach. Your task is to analyse a completed interview session and generate a structured, detailed, and actionable feedback report for the candidate.
{data_notice}
# CONTEXT VARIABLES
{{INTERVIEW_TYPE}}: {interview_type}
{{INTERVIEW_DURATION}}: {duration_str}
{{INTERVIEW_MODE}}: "chat"
{{RESUME_DATA}}: {resume_text}
{{TRANSCRIPT}}:
{formatted_history}

# FEEDBACK DEPTH BY DURATION
IF {duration_str} == "5min":
  Generate: scorecard_summary, top_strengths(3), improvement_areas(2), readiness_verdict

IF {duration_str} == "15min":
  Generate: scorecard_summary, section_breakdown, per_question_highlights, top_strengths(3), improvement_areas(3), readiness_verdict, suggested_followups

IF {duration_str} == "60min":
  Generate: ALL sections — full per_question_analysis, resume_vs_answer_consistency, communication_metrics, scorecard_summary, section_breakdown, top_strengths(5), improvement_areas(5), readiness_verdict, suggested_followups, prep_plan

# OUTPUT SCHEMA — return strict JSON
{{
  "meta": {{
    "interview_type": "{interview_type}",
    "duration": "{duration_str}",
    "mode": "chat",
    "generated_at": "YYYY-MM-DDTHH:MM:SSZ"
  }},
  "scorecard": {{
    "overall_score": 0,
    "dimensions": [
      {{ "name": "string", "score": 0, "weight": 0.0, "summary": "string" }}
    ]
  }},
  "section_breakdown": [
    {{ "section": "string", "score": 0, "highlight": "string" }}
  ],
  "per_question_analysis": [
    {{
      "question": "string",
      "candidate_answer_summary": "string",
      "score": 0,
      "star_method_used": false,
      "completeness": "complete",
      "what_was_strong": "string",
      "what_was_missing": "string",
      "model_answer_hint": "string"
    }}
  ],
  "resume_consistency": {{
    "consistent_points": ["string"],
    "discrepancies": [
      {{ "resume_claim": "string", "interview_response": "string", "flag": "string" }}
    ],
    "unexplored_resume_strengths": ["string"]
  }},
  "communication_metrics": {{
    "response_length_quality": "optimal",
    "structured_thinking_score": 0,
    "active_listening_score": 0
  }},
  "strengths": [
    {{ "title": "string", "evidence": "string" }}
  ],
  "improvement_areas": [
    {{ "title": "string", "issue": "string", "actionable_tip": "string" }}
  ],
  "suggested_followups": [
    {{ "original_question": "string", "better_approach": "string" }}
  ],
  "readiness_verdict": {{
    "status": "interview_ready",
    "label": "string",
    "summary": "string",
    "next_step": "string"
  }},
  "prep_plan": {{
    "focus_topics": ["string"],
    "question_types_to_practice": ["string"],
    "estimated_ready_in": "string"
  }}
}}

# STRICT RULES
- Return ONLY the JSON object. No markdown, no preamble, no explanation.
- Scores must be integers. Weights must sum to 1.0.
- Evidence in strengths must reference actual transcript content.
- Discrepancies must only be flagged when there is clear contradiction, not minor elaboration.
- Adapt dimension names for interview_type:
    general      -> Communication, Self-Awareness, Cultural Fit, Storytelling, Confidence
    technical    -> Conceptual Accuracy, Problem Approach, Edge Case Awareness, Terminology, Depth
    projects     -> Ownership, Decision Articulation, Challenge Handling, Outcome Quantification, Depth
- Audio metrics are disabled for chat mode.
"""
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )

            logger.info("Raw LLM response received for interview")
            response_text = response.text.strip()
            
            if response_text.startswith('```json'):
                response_text = response_text.replace('```json', '', 1)
                response_text = response_text.rsplit('```', 1)[0]
            elif response_text.startswith('```'):
                response_text = response_text.replace('```', '', 1)
                response_text = response_text.rsplit('```', 1)[0]
                
            response_text = response_text.strip()
            
            try:
                parsed_json = json.loads(response_text)
                # Inject disclaimer for short interviews
                if is_short_interview and "meta" in parsed_json:
                    parsed_json["meta"]["disclaimer"] = (
                        "This interview was very short. Results may not be fully accurate. "
                        "For better feedback, try a longer interview (15+ minutes)."
                    )
                return parsed_json
            except json.JSONDecodeError as je:
                logger.error(f"❌ Failed to parse LLM interview response as JSON: {je}")
                logger.info("Returning fallback report instead of error")
                return self._build_fallback_report(interview_type, duration_str, is_short=is_short_interview)

        except Exception as e:
            logger.error(f"Error generating interview report: {e}")
            return self._build_fallback_report(interview_type, duration_str, is_short=is_short_interview)

# Global instance
report_agent = ReportAgent(
    api_key=Config.GEMINI_API_KEY,
    model_name=Config.REPORT_MODEL
)
