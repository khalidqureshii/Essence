'use client';

import { Download } from 'lucide-react'

interface HeaderProps {
  projectName: string
  overallScore: number
}

export default function Header({ projectName, overallScore }: HeaderProps) {
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
    <header className="border-b border-border bg-gradient-to-b from-card to-background/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">PROJECT EVALUATION REPORT</div>
            <h1 className="text-4xl font-bold text-foreground text-balance">{projectName}</h1>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors font-medium"
            style={{ backgroundColor: '#00d9ff', color: '#0f1e2f', border: 'none' }}
          >
            <Download className="w-5 h-5" />
            Download PDF
          </button>
        </div>
      </div>
    </header>
  )
}
