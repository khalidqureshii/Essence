'use client'

import { useState } from 'react'
import { Lightbulb, TrendingUp, AlertCircle } from 'lucide-react'
import FeedbackCard from './FeedbackCard'

interface FeedbackData {
  strengths: string[]
  improvements: string[]
  recommendations: string[]
}

interface FeedbackSectionProps {
  feedback: FeedbackData
}

export default function FeedbackSection({ feedback }: FeedbackSectionProps) {
  const [expandedSection, setExpandedSection] = useState<'strengths' | 'improvements' | 'recommendations'>('strengths')

  return (
    <section className="mb-16">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Expert Feedback & Recommendations</h2>
        <p className="text-muted-foreground">Comprehensive analysis and actionable insights for improvement</p>
      </div>

      {/* Feedback Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => setExpandedSection('strengths')}
          className={`text-left p-6 rounded-xl border transition-all ${expandedSection === 'strengths'
              ? 'bg-gradient-to-br from-emerald-900/20 to-teal-900/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
              : 'bg-card border-border hover:border-border/80'
            }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-semibold text-foreground text-lg">Strengths</h3>
          </div>
          <p className="text-sm text-muted-foreground">{feedback.strengths.length} key strengths identified</p>
        </button>

        <button
          onClick={() => setExpandedSection('improvements')}
          className={`text-left p-6 rounded-xl border transition-all ${expandedSection === 'improvements'
              ? 'bg-gradient-to-br from-yellow-900/20 to-orange-900/10 border-yellow-500/50 shadow-lg shadow-yellow-500/10'
              : 'bg-card border-border hover:border-border/80'
            }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <h3 className="font-semibold text-foreground text-lg">Areas to Improve</h3>
          </div>
          <p className="text-sm text-muted-foreground">{feedback.improvements.length} improvements suggested</p>
        </button>

        <button
          onClick={() => setExpandedSection('recommendations')}
          className={`text-left p-6 rounded-xl border transition-all ${expandedSection === 'recommendations'
              ? 'bg-gradient-to-br from-cyan-900/20 to-blue-900/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
              : 'bg-card border-border hover:border-border/80'
            }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Lightbulb className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="font-semibold text-foreground text-lg">Recommendations</h3>
          </div>
          <p className="text-sm text-muted-foreground">{feedback.recommendations.length} features to consider</p>
        </button>
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        {expandedSection === 'strengths' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {feedback.strengths.map((strength, index) => (
              <FeedbackCard
                key={index}
                icon={<TrendingUp className="w-5 h-5" />}
                color="emerald"
                title={`Strength ${index + 1}`}
                content={strength}
                index={index}
              />
            ))}
          </div>
        )}

        {expandedSection === 'improvements' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {feedback.improvements.map((improvement, index) => (
              <FeedbackCard
                key={index}
                icon={<AlertCircle className="w-5 h-5" />}
                color="yellow"
                title={`Area to Improve ${index + 1}`}
                content={improvement}
                index={index}
              />
            ))}
          </div>
        )}

        {expandedSection === 'recommendations' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {feedback.recommendations.map((recommendation, index) => (
              <FeedbackCard
                key={index}
                icon={<Lightbulb className="w-5 h-5" />}
                color="cyan"
                title={`Recommendation ${index + 1}`}
                content={recommendation}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="mt-12 bg-gradient-to-r from-card to-secondary border border-border rounded-xl p-8 backdrop-blur-sm">
        <h3 className="text-xl font-semibold text-foreground mb-4">Next Steps</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm">1</div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Priority Fixes</h4>
              <p className="text-sm text-muted-foreground">Address the error handling and edge case coverage gaps immediately</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm">2</div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Short-term Goals</h4>
              <p className="text-sm text-muted-foreground">Enhance logging and implement comprehensive test coverage</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm">3</div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Long-term Vision</h4>
              <p className="text-sm text-muted-foreground">Explore advanced features and scale the architecture for growth</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
