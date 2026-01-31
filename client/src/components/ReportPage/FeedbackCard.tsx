'use client'

import type { ReactNode } from 'react'

interface FeedbackCardProps {
  icon: ReactNode
  color: 'emerald' | 'yellow' | 'cyan'
  title: string
  content: string
  index: number
}

export default function FeedbackCard({ icon, color, title, content, index }: FeedbackCardProps) {
  const colorStyles = {
    emerald: {
      bg: 'from-emerald-900/15 to-teal-900/10',
      border: 'border-emerald-500/30',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-400',
    },
    yellow: {
      bg: 'from-yellow-900/15 to-orange-900/10',
      border: 'border-yellow-500/30',
      iconBg: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400',
      badge: 'bg-yellow-500/20 text-yellow-400',
    },
    cyan: {
      bg: 'from-cyan-900/15 to-blue-900/10',
      border: 'border-cyan-500/30',
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
      badge: 'bg-cyan-500/20 text-cyan-400',
    },
  }

  const styles = colorStyles[color]

  return (
    <div
      className={`group bg-gradient-to-br ${styles.bg} border ${styles.border} rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-${color}-500/10 relative overflow-hidden`}
      style={{
        animation: `slideIn 0.4s ease-out ${index * 0.1}s backwards`,
      }}
    >
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>

      {/* Background accent */}
      <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-${color}-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="relative z-10">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 p-3 rounded-lg ${styles.iconBg} ${styles.iconColor} group-hover:scale-110 transition-transform`}>
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-foreground group-hover:text-accent transition-colors">{title}</h4>
              <span className={`text-xs px-2.5 py-0.5 rounded-full ${styles.badge} font-medium`}>
                {index + 1}
              </span>
            </div>
            <p className="text-foreground/80 leading-relaxed">{content}</p>
          </div>
        </div>

        {/* Decorative element */}
        <div className="absolute -bottom-1 -right-1 w-16 h-16 rounded-full opacity-0 group-hover:opacity-10 bg-gradient-to-t from-accent to-transparent blur-xl transition-opacity duration-300" />
      </div>
    </div>
  )
}
