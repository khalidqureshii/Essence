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

            Your task is to generate a structured evaluation report about a software project based ONLY on the information previously provided (conversation, demo explanation, or project walkthrough).

            Conversation History:
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
            logger.error(f"Error generating report: {e}")
            return {"error": f"Error generating report: {str(e)}"}

# Global instance
report_agent = ReportAgent(
    api_key=Config.GEMINI_API_KEY,
    model_name=Config.REPORT_MODEL
)
