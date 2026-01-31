'use client'

import MetricCard from './MetricCard'

interface Metric {
  name: string
  score: number
  description: string
}

interface MetricsGridProps {
  metrics: Metric[]
  selectedMetric: Metric | null
  onSelectMetric: (metric: Metric) => void
}

export default function MetricsGrid({ metrics, selectedMetric, onSelectMetric }: MetricsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.name}
          metric={metric}
          isSelected={selectedMetric?.name === metric.name}
          onClick={() => onSelectMetric(metric)}
        />
      ))}
    </div>
  )
}
