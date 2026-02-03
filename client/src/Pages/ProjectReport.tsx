'use client'

import { useEffect, useState } from 'react'
import Header from '../components/ReportPage/Header'
import OverallRatingCard from '../components/ReportPage/OverallRatingCard'
import EvaluationMetrics from '../components/ReportPage/EvaluationMetrics'
import FeedbackSection from '../components/ReportPage/FeedbackSection'
import '../globals.css'

interface ProjectReportProps {
  onBack: () => void
  report: any // Report data from the API
}

export default function Home({ onBack, report }: ProjectReportProps) {
  // const [isLoading, setIsLoading] = useState(false)

  const [evaluationData, setEvaluationData] = useState({
    overallScore: 78,
    completedAt: new Date().toLocaleDateString(),
    metrics: [
      {
        name: 'Problem Relevance',
        score: 85,
        description: 'How meaningful and well-defined is the problem the project aims to solve?',
        feedback: "",
      },
      {
        name: 'Solution Effectiveness',
        score: 82,
        description: 'How effectively does the implemented solution address the stated problem?',
        feedback: "",
      },
      {
        name: 'Technical Architecture Quality',
        score: 75,
        description: 'How well-structured and logically designed is the system architecture?',
        feedback: "",
      },
      {
        name: 'Technology Stack Appropriateness',
        score: 88,
        description: 'How suitable are the chosen technologies for the project\'s goals and scale?',
        feedback: "",
      },
      {
        name: 'Feature Completeness',
        score: 72,
        description: 'Are the core and supporting features fully implemented as expected?',
        feedback: "",
      },
      {
        name: 'Innovation & Uniqueness',
        score: 79,
        description: 'Does the project demonstrate originality or creative problem-solving?',
        feedback: "",
      },
      {
        name: 'Functionality & Stability',
        score: 80,
        description: 'Does the system operate reliably under normal usage conditions?',
        feedback: "",
      },
      {
        name: 'Error Handling & Edge Case Coverage',
        score: 68,
        description: 'How well does the project manage invalid inputs, failures, and uncommon scenarios?',
        feedback: "",
      },
      {
        name: 'Scalability Potential',
        score: 76,
        description: 'Can the system be extended to handle growth in users, data, or features?',
        feedback: "",
      },
      {
        name: 'Performance Efficiency',
        score: 81,
        description: 'Are performance and resource usage reasonably optimized?',
        feedback: "",
      },
      {
        name: 'Integration Quality',
        score: 77,
        description: 'How well do different components (frontend, backend, APIs, external services) work together?',
        feedback: "",
      },
      {
        name: 'Limitations & Future Scope Awareness',
        score: 74,
        description: 'Does the project clearly acknowledge current limitations and possible future improvements?',
        feedback: "",
      },
      {
        name: 'Overall Project Maturity',
        score: 78,
        description: 'How polished, complete, and production-like does the project feel overall?',
        feedback: "",
      },
    ],
    feedback: {
      strengths: [
        'Strong problem definition and clear understanding of user needs',
        'Well-chosen technology stack that scales well with the project requirements',
        'Good UI/UX implementation with responsive design',
        'Solid API design with clear documentation',
      ],
      improvements: [
        'Enhance error handling mechanisms with more comprehensive fallback strategies',
        'Add comprehensive logging and monitoring for production debugging',
        'Implement advanced caching strategies to improve performance further',
        'Expand test coverage, particularly for edge cases and failure scenarios',
        'Create detailed architecture documentation for future maintenance',
      ],
      recommendations: [
        'Consider implementing real-time features using WebSockets for live notifications',
        'Add analytics and user behavior tracking to understand usage patterns',
        'Implement automated deployment pipeline with CI/CD best practices',
        'Create comprehensive API documentation with interactive examples (Swagger/OpenAPI)',
        'Consider adding machine learning features for personalized recommendations',
      ],
    },
  });


  useEffect(() => {
    if (!report?.report?.evaluation) return;

    console.log("🚀 report:", report.report);

    // Create lookup map from API metrics
    const evaluationMap = Object.fromEntries(
      report.report.evaluation.map((m: any) => [
        m.parameter,
        {
          score: m.score,
          feedback: m.feedback
        }
      ])
    );

    setEvaluationData(prev => ({
      ...prev,
      metrics: prev.metrics.map(metric => {
        const match = evaluationMap[metric.name];

        return {
          ...metric,
          score: match.score,
          feedback: match.feedback
        };
      })
    }));
  }, [report]);


  useEffect(() => {
    console.log("🚀 ~ Home ~ evaluationData:", evaluationData)
  }, [evaluationData]);
  // Sample evaluation data - replace with actual API call


  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header overallScore={report.report.overall_score} onBack={onBack} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overall Rating Card */}
        <OverallRatingCard overallScore={report.report.overall_score} />

        {/* Metrics Section */}
        <EvaluationMetrics metrics={evaluationData.metrics} />

        {/* Feedback Section */}
        <FeedbackSection strengths={report.report.strengths} improvements={report.report.areas_to_improve} recommendations={report.report.recommendations} next_steps={report.report.next_steps} />
      </main>
    </div>
  )
}
