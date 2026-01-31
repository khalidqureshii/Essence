'use client'

import { useState } from 'react'
import Header from '../components/ReportPage/Header'
import OverallRatingCard from '../components/ReportPage/OverallRatingCard'
import EvaluationMetrics from '../components/ReportPage/EvaluationMetrics'
import FeedbackSection from '../components/ReportPage/FeedbackSection'
import '../globals.css'

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)

  // Sample evaluation data - replace with actual API call
  const evaluationData = {
    projectName: 'E-Commerce Platform',
    overallScore: 78,
    completedAt: new Date().toLocaleDateString(),
    metrics: [
      {
        name: 'Problem Relevance',
        score: 85,
        description: 'How meaningful and well-defined is the problem the project aims to solve?',
      },
      {
        name: 'Solution Effectiveness',
        score: 82,
        description: 'How effectively does the implemented solution address the stated problem?',
      },
      {
        name: 'Technical Architecture Quality',
        score: 75,
        description: 'How well-structured and logically designed is the system architecture?',
      },
      {
        name: 'Technology Stack Appropriateness',
        score: 88,
        description: 'How suitable are the chosen technologies for the project\'s goals and scale?',
      },
      {
        name: 'Feature Completeness',
        score: 72,
        description: 'Are the core and supporting features fully implemented as expected?',
      },
      {
        name: 'Innovation & Uniqueness',
        score: 79,
        description: 'Does the project demonstrate originality or creative problem-solving?',
      },
      {
        name: 'Functionality & Stability',
        score: 80,
        description: 'Does the system operate reliably under normal usage conditions?',
      },
      {
        name: 'Error Handling & Edge Case Coverage',
        score: 68,
        description: 'How well does the project manage invalid inputs, failures, and uncommon scenarios?',
      },
      {
        name: 'Scalability Potential',
        score: 76,
        description: 'Can the system be extended to handle growth in users, data, or features?',
      },
      {
        name: 'Performance Efficiency',
        score: 81,
        description: 'Are performance and resource usage reasonably optimized?',
      },
      {
        name: 'Integration Quality',
        score: 77,
        description: 'How well do different components (frontend, backend, APIs, external services) work together?',
      },
      {
        name: 'Limitations & Future Scope Awareness',
        score: 74,
        description: 'Does the project clearly acknowledge current limitations and possible future improvements?',
      },
      {
        name: 'Overall Project Maturity',
        score: 78,
        description: 'How polished, complete, and production-like does the project feel overall?',
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
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header projectName={evaluationData.projectName} overallScore={evaluationData.overallScore} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overall Rating Card */}
        <OverallRatingCard overallScore={evaluationData.overallScore} />

        {/* Metrics Section */}
        <EvaluationMetrics metrics={evaluationData.metrics} />

        {/* Feedback Section */}
        <FeedbackSection feedback={evaluationData.feedback} />
      </main>
    </div>
  )
}
