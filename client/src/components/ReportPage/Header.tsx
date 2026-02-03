'use client';

import { Download, ArrowLeft } from 'lucide-react'

interface HeaderProps {
  overallScore: number
  onBack: () => void
}

export default function Header({ overallScore, onBack }: HeaderProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400'
    if (score >= 75) return 'text-cyan-400'
    if (score >= 65) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <header className="border-b border-border bg-gradient-to-b from-card to-background/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-muted/20 transition-colors"
              title="Back to Chat"
            >
              <ArrowLeft className="w-6 h-6 text-muted-foreground hover:text-foreground" />
            </button>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1 tracking-wider">OFFICIAL EVALUATION</div>
              <h1 className="text-4xl font-bold text-foreground text-balance">Project Report</h1>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors font-medium shadow-lg shadow-accent/20"
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
