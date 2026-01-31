'use client'

import { useState } from 'react'
import MetricsGrid from './MetricsGrid'

interface Metric {
  name: string
  score: number
  description: string
}

interface EvaluationMetricsProps {
  metrics: Metric[]
}

export default function EvaluationMetrics({ metrics }: EvaluationMetricsProps) {
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const avgScore = Math.round(metrics.reduce((acc, m) => acc + m.score, 0) / metrics.length)
  const categorizeScore = (score: number) => {
    if (score >= 85) return 'Excellent'
    if (score >= 75) return 'Good'
    if (score >= 65) return 'Fair'
    return 'Needs Improvement'
  }

  // Sort metrics by score for ranked view
  const sortedMetrics = [...metrics].sort((a, b) => b.score - a.score)

  return (
    <section className="mb-16">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Technical Evaluation</h2>
            <p className="text-muted-foreground">Detailed assessment across 13 key dimensions</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'grid'
                ? 'bg-accent text-accent-foreground'
                : 'bg-card text-foreground hover:bg-secondary'
                }`}
              style={{
                backgroundColor: viewMode === 'grid' ? '#00d9ff' : '#1a2d42',
                color: viewMode === 'grid' ? '#0f1e2f' : '#e8f0f8',
                border: 'none'
              }}
            >
              Grid View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg transition-colors ${viewMode === 'list'
                ? 'bg-accent text-accent-foreground'
                : 'bg-card text-foreground hover:bg-secondary'
                }`}
              style={{
                backgroundColor: viewMode === 'list' ? '#00d9ff' : '#1a2d42',
                color: viewMode === 'list' ? '#0f1e2f' : '#e8f0f8',
                border: 'none'
              }}
            >
              Ranked List
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-card to-secondary border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-2">AVERAGE SCORE</p>
            <p className="text-4xl font-bold text-accent">{avgScore}/100</p>
          </div>
          <div className="bg-gradient-to-br from-card to-secondary border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-2">TOTAL METRICS</p>
            <p className="text-4xl font-bold text-accent">{metrics.length}</p>
          </div>
          <div className="bg-gradient-to-br from-card to-secondary border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-2">OVERALL RATING</p>
            <p className="text-2xl font-bold text-cyan-400">{categorizeScore(avgScore)}</p>
          </div>
        </div>
      </div>

      {/* Metrics Display */}
      {viewMode === 'grid' ? (
        <MetricsGrid metrics={metrics} selectedMetric={selectedMetric} onSelectMetric={setSelectedMetric} />
      ) : (
        <div className="space-y-3">
          {sortedMetrics.map((metric, index) => (
            <div
              key={metric.name}
              className="bg-card border border-border rounded-xl p-5 hover:border-accent/50 cursor-pointer transition-all hover:shadow-lg hover:shadow-accent/10 hover:bg-secondary/50"
              onClick={() => setSelectedMetric(metric)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-accent">{index + 1}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{metric.name}</h3>
                    <p className="text-sm text-muted-foreground">{metric.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-accent">{metric.score}</p>
                  <p className="text-xs text-muted-foreground">out of 100</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${metric.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Metric Details */}
      {selectedMetric && viewMode === 'grid' && (
        <div className="mt-8 bg-gradient-to-br from-card to-secondary border border-accent/20 rounded-xl p-8 backdrop-blur-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-2">{selectedMetric.name}</h3>
              <p className="text-foreground/80">{selectedMetric.description}</p>
            </div>
            <button
              onClick={() => setSelectedMetric(null)}
              className="text-muted-foreground hover:text-foreground text-2xl"
            >
              ×
            </button>
          </div>
          <div className="mb-6">
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-5xl font-bold text-accent">{selectedMetric.score}</span>
              <span className="text-xl text-muted-foreground">/100</span>
            </div>
            <div className="w-full bg-background rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                style={{ width: `${selectedMetric.score}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-background rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-2">ASSESSMENT</p>
              <p className="text-lg font-semibold text-foreground">
                {selectedMetric.score >= 85 ? 'Excellent' : selectedMetric.score >= 75 ? 'Good' : selectedMetric.score >= 65 ? 'Fair' : 'Needs Improvement'}
              </p>
            </div>
            <div className="bg-background rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-2">PERCENTILE</p>
              <p className="text-lg font-semibold text-accent">{selectedMetric.score}th</p>
            </div>
            <div className="bg-background rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-2">STATUS</p>
              <p className="text-lg font-semibold text-cyan-400">
                {selectedMetric.score >= 80 ? 'Strong' : 'Development Area'}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
