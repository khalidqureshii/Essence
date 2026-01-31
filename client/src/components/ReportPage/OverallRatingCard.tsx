'use client';

interface OverallRatingCardProps {
  overallScore: number
}

export default function OverallRatingCard({ overallScore }: OverallRatingCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400'
    if (score >= 75) return 'text-cyan-400'
    if (score >= 65) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 85) return 'from-emerald-900/30 to-emerald-900/10'
    if (score >= 75) return 'from-cyan-900/30 to-cyan-900/10'
    if (score >= 65) return 'from-yellow-900/30 to-yellow-900/10'
    return 'from-red-900/30 to-red-900/10'
  }

  return (
    <div className={`bg-gradient-to-br ${getScoreBg(overallScore)} border border-border rounded-2xl p-8 backdrop-blur-sm mb-12`}>
      <div className="flex items-center justify-between gap-8">
        <div className="flex-1">
          <p className="text-muted-foreground text-sm mb-3">OVERALL RATING</p>
          <div className="flex items-baseline gap-3 mb-6">
            <span className={`text-6xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}
            </span>
            <span className="text-2xl text-muted-foreground">/100</span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Rating</p>
              <p className={`text-lg font-semibold ${getScoreColor(overallScore)}`}>
                {overallScore >= 85 ? 'Excellent' : overallScore >= 75 ? 'Good' : overallScore >= 65 ? 'Fair' : 'Needs Improvement'}
              </p>
            </div>
          </div>
        </div>
        <div className="hidden sm:block relative w-32 h-32 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgb(45, 65, 87)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth="8"
              strokeDasharray={`${(overallScore / 100) * 282.7} 282.7`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00d9ff" />
                <stop offset="100%" stopColor="#0aff8f" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  )
}
