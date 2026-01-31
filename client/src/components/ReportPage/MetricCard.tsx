'use client'

import { ChevronRight } from 'lucide-react'

interface Metric {
  name: string
  score: number
  description: string
}

interface MetricCardProps {
  metric: Metric
  isSelected: boolean
  onClick: () => void
}

export default function MetricCard({ metric, isSelected, onClick }: MetricCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'from-emerald-500/30 to-teal-500/30'
    if (score >= 75) return 'from-cyan-500/30 to-blue-500/30'
    if (score >= 65) return 'from-yellow-500/30 to-orange-500/30'
    return 'from-red-500/30 to-pink-500/30'
  }

  const getProgressColor = (score: number) => {
    if (score >= 85) return 'from-emerald-500 to-teal-500'
    if (score >= 75) return 'from-cyan-500 to-blue-500'
    if (score >= 65) return 'from-yellow-500 to-orange-500'
    return 'from-red-500 to-pink-500'
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500/20 text-emerald-400'
    if (score >= 75) return 'bg-cyan-500/20 text-cyan-400'
    if (score >= 65) return 'bg-yellow-500/20 text-yellow-400'
    return 'bg-red-500/20 text-red-400'
  }

  return (
    <div
      onClick={onClick}
      className={`group relative bg-gradient-to-br ${getScoreColor(metric.score)} border rounded-xl p-6 cursor-pointer transition-all duration-300 overflow-hidden
        ${isSelected
          ? 'border-accent shadow-lg shadow-accent/20 bg-gradient-to-br from-card to-secondary'
          : 'border-border hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10'
        }`}
    >
      {/* Background accent animation */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors flex-1 text-balance">
            {metric.name}
          </h3>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
        </div>

        <p className="text-sm text-muted-foreground mb-5 line-clamp-2">{metric.description}</p>

        {/* Score Badge */}
        <div className="mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${getScoreBadgeColor(metric.score)}`}>
            <span className="text-sm font-bold">{metric.score}</span>
            <span className="text-xs">/100</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className="text-xs font-semibold text-accent">{metric.score}%</span>
          </div>
          <div className="w-full bg-background/50 rounded-full h-2 overflow-hidden backdrop-blur-sm">
            <div
              className={`h-full bg-gradient-to-r ${getProgressColor(metric.score)} rounded-full transition-all duration-500 shadow-lg shadow-current/30`}
              style={{ width: `${metric.score}%` }}
            />
          </div>
        </div>

        {/* Status indicator */}
        <div className="mt-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs text-muted-foreground">
            {metric.score >= 80
              ? 'Strong Performance'
              : metric.score >= 70
                ? 'Good Performance'
                : 'Needs Attention'}
          </span>
        </div>
      </div>

      {/* Decorative element */}
      {isSelected && (
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-accent/20 to-transparent rounded-bl-full" />
      )}
    </div>
  )
}
