import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ResponsiveContainer
} from 'recharts';
import { CheckCircle, XCircle, AlertCircle, ArrowLeft, Download, RefreshCw, Info } from 'lucide-react';
import * as Accordion from '@radix-ui/react-accordion';

interface InterviewReportProps {
  onBack: () => void;
  report: any;
  duration: number;
}

export default function InterviewReport({ onBack, report, duration }: InterviewReportProps) {
  // Gracefully handle missing data
  if (!report || !report.report) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Error loading report. Please try generating again.
      </div>
    );
  }

  const r = report.report;
  
  // Destructure with fallbacks
  const meta = r.meta || {};
  const scorecard = r.scorecard || { overall_score: 0, dimensions: [] };
  const sectionBreakdown = r.section_breakdown || [];
  const qaAnalysis = r.per_question_analysis || [];
  const resumeCon = r.resume_consistency || { consistent_points: [], discrepancies: [], unexplored_resume_strengths: [] };
  const strengths = r.strengths || [];
  const improvements = r.improvement_areas || [];
  const verdict = r.readiness_verdict || { status: 'needs_work', label: 'Incomplete', summary: 'Missing evaluation data.' };
  const prepPlan = r.prep_plan;

  // Radar chart data mapping
  const radarData = useMemo(() => {
    return scorecard.dimensions.map((d: any) => ({
      subject: d.name,
      A: d.score,
      fullMark: 100
    }));
  }, [scorecard]);

  // Color mappings based on verdict
  const verdictColors = {
    interview_ready: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', text: 'text-emerald-500', bar: '#10b981' },
    needs_practice: { bg: 'bg-amber-500/10', border: 'border-amber-500/50', text: 'text-amber-500', bar: '#f59e0b' },
    needs_work: { bg: 'bg-red-500/10', border: 'border-red-500/50', text: 'text-red-500', bar: '#ef4444' }
  };
  
  const currentVerdict = verdictColors[verdict.status as keyof typeof verdictColors] || verdictColors.needs_practice;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-y-auto">
      {/* Header bar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Interview Evaluation</h1>
            <p className="text-sm text-muted-foreground capitalize">{meta.interview_type} • {meta.duration}</p>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-32">
        
        {/* 1. Verdict Banner */}
        <section className={`rounded-3xl p-8 border ${currentVerdict.border} ${currentVerdict.bg} flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-sm shadow-xl`}>
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold border ${currentVerdict.border}`}>
               <span className="uppercase tracking-wider">{verdict.label}</span>
            </div>
            <p className="text-lg opacity-90 leading-relaxed font-medium">{verdict.summary}</p>
            {verdict.next_step && (
              <p className="text-sm font-semibold opacity-80 border-t border-current/20 pt-4 mt-4 inline-block">
                Next Step: {verdict.next_step}
              </p>
            )}
          </div>
          
          <div className="flex-shrink-0 w-48 h-48 relative flex items-center justify-center">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ value: scorecard.overall_score }, { value: 100 - scorecard.overall_score }]}
                  cx="50%" cy="50%"
                  innerRadius={65} outerRadius={80}
                  startAngle={90} endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill={currentVerdict.bar} className="animate-[spin_1s_ease-out]" />
                  <Cell fill="var(--border)" opacity={0.3} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className={`text-4xl font-black ${currentVerdict.text}`}>{scorecard.overall_score}</span>
              <span className="text-xs uppercase tracking-widest opacity-60 font-bold mt-1">Score</span>
            </div>
          </div>
        </section>

        {/* 2 & 3. Score Breakdown & Radar */}
        {scorecard.dimensions.length > 0 && (
          <section className="bg-card border border-border/50 rounded-3xl p-8 shadow-lg">
            <h2 className="text-x font-bold tracking-tight mb-6">Dimension Analysis</h2>
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1 w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="var(--border)" strokeDasharray="3 3"/>
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--foreground)', fontSize: 12 }} />
                    <Radar name="Score" dataKey="A" stroke={currentVerdict.bar} fill={currentVerdict.bar} fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 w-full space-y-4">
                {scorecard.dimensions.map((dim: any, i: number) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="font-semibold">{dim.name}</span>
                      <span className={`font-mono font-bold ${dim.score >= 80 ? 'text-emerald-500' : dim.score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{dim.score} / 100</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${dim.score >= 80 ? 'bg-emerald-500' : dim.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${dim.score}%` }} 
                      />
                    </div>
                    {dim.summary && <p className="text-xs text-muted-foreground">{dim.summary}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 4. Strengths & Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <section className="bg-card border border-border/50 rounded-3xl p-6 shadow-lg">
            <h3 className="text-lg font-bold flex items-center text-emerald-500 mb-6 border-b border-border/50 pb-4">
              <CheckCircle className="mr-2" /> Top Strengths
            </h3>
            <ul className="space-y-4">
               {strengths.map((str: any, i: number) => (
                 <li key={i} className="bg-secondary/20 p-4 rounded-2xl border border-border/30">
                   <h4 className="font-bold text-sm mb-1">{str.title}</h4>
                   <p className="text-xs opacity-80 leading-relaxed italic border-l-2 border-emerald-500/50 pl-2">"{str.evidence}"</p>
                 </li>
               ))}
            </ul>
           </section>

           <section className="bg-card border border-border/50 rounded-3xl p-6 shadow-lg">
            <h3 className="text-lg font-bold flex items-center text-amber-500 mb-6 border-b border-border/50 pb-4">
              <AlertCircle className="mr-2" /> Actionable Improvements
            </h3>
            <ul className="space-y-4">
               {improvements.map((imp: any, i: number) => (
                 <li key={i} className="bg-secondary/20 p-4 rounded-2xl border border-border/30">
                   <h4 className="font-bold text-sm mb-1">{imp.title}</h4>
                   <p className="text-xs opacity-70 mb-2 leading-relaxed">{imp.issue}</p>
                   <div className="text-xs font-semibold text-amber-500/90 bg-amber-500/10 p-2 rounded-lg inline-block">💡 Tip: {imp.actionable_tip}</div>
                 </li>
               ))}
            </ul>
           </section>
        </div>

        {/* 5. Resume Consistency */}
        {(duration >= 15 || resumeCon.discrepancies?.length > 0) && (
          <section className="bg-card border border-border/50 rounded-3xl p-8 shadow-lg">
            <h2 className="text-xl font-bold tracking-tight mb-6 flex items-center">
              Resume Consistency Match <Info className="ml-2 w-5 h-5 opacity-50" />
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div className="space-y-3">
                 <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-widest border-b border-border pb-2">Validated Claims</h4>
                 <ul className="text-sm space-y-2 list-disc list-inside opacity-80">
                   {resumeCon.consistent_points?.map((p: string, i: number) => <li key={i}>{p}</li>) || <li className="italic opacity-50">None highlighted.</li>}
                 </ul>
               </div>

               <div className="space-y-3 lg:col-span-2">
                 <h4 className="text-sm font-bold text-red-500 uppercase tracking-widest border-b border-border pb-2">Flagged Discrepancies</h4>
                 {resumeCon.discrepancies?.length > 0 ? (
                   <ul className="space-y-3">
                     {resumeCon.discrepancies.map((d: any, i: number) => (
                       <li key={i} className="bg-red-500/5 p-3 rounded-xl border border-red-500/20 text-sm">
                         <div><strong>Claim:</strong> <span className="opacity-80">{d.resume_claim}</span></div>
                         <div className="mt-1"><strong>Interview Reality:</strong>  <span className="opacity-80">{d.interview_response}</span></div>
                         <div className="mt-2 text-xs font-bold text-red-400 bg-red-400/10 w-fit px-2 py-1 rounded">⚠️ {d.flag}</div>
                       </li>
                     ))}
                   </ul>
                 ) : (
                   <div className="text-sm opacity-60 italic bg-secondary/30 p-4 rounded-xl text-center">Perfect match! No contradictions detected between your resume and verbal answers.</div>
                 )}
               </div>
            </div>
            
            {resumeCon.unexplored_resume_strengths?.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border/30">
                 <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Missed Opportunities</h4>
                 <div className="flex flex-wrap gap-2">
                    {resumeCon.unexplored_resume_strengths.map((s: string, i: number) => (
                      <span key={i} className="text-xs bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full border border-blue-500/20">
                        {s}
                      </span>
                    ))}
                 </div>
              </div>
            )}
          </section>
        )}

        {/* 6. Per-Question Analysis (15min + 60min) */}
        {qaAnalysis.length > 0 && (
          <section className="bg-card border border-border/50 rounded-3xl p-8 shadow-lg">
            <h2 className="text-xl font-bold tracking-tight mb-6">Detailed Answer Review</h2>
            
            <Accordion.Root type="single" collapsible className="space-y-3">
              {qaAnalysis.map((qa: any, i: number) => (
                <Accordion.Item key={i} value={`val-${i}`} className="border border-border/50 rounded-2xl overflow-hidden bg-background">
                  <Accordion.Header>
                    <Accordion.Trigger className="w-full text-left p-5 flex items-start justify-between group hover:bg-secondary/20 transition-colors">
                      <div className="pr-8">
                        <div className="text-xs text-muted-foreground font-mono mb-2 uppercase font-bold tracking-widest">Question {i + 1}</div>
                        <h3 className="font-semibold text-lg leading-snug">{qa.question}</h3>
                      </div>
                      <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg border-2 ${qa.score >= 80 ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10' : qa.score >= 60 ? 'border-amber-500/50 text-amber-500 bg-amber-500/10' : 'border-red-500/50 text-red-500 bg-red-500/10'}`}>
                        {qa.score}
                      </div>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="p-5 border-t border-border/50 bg-secondary/10 space-y-6 pt-6">
                    
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">Your Answer</h4>
                      <p className="text-sm opacity-90 leading-relaxed border-l-2 border-primary/50 pl-3">{qa.candidate_answer_summary}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-background rounded-xl p-4 border border-border/50 shadow-inner">
                        <h4 className="text-xs font-bold uppercase text-emerald-500 mb-2">What Was Strong</h4>
                        <p className="text-sm opacity-80">{qa.what_was_strong}</p>
                      </div>
                      <div className="bg-background rounded-xl p-4 border border-border/50 shadow-inner">
                        <h4 className="text-xs font-bold uppercase text-amber-500 mb-2">What Was Missing</h4>
                        <p className="text-sm opacity-80">{qa.what_was_missing}</p>
                      </div>
                    </div>

                    <div className="bg-primary/5 rounded-xl p-5 border border-primary/20">
                      <h4 className="text-xs font-bold uppercase text-primary mb-2 flex items-center">
                        <Info size={14} className="mr-1" /> Ideal Framework Hint
                      </h4>
                      <p className="text-sm opacity-90 italic">{qa.model_answer_hint}</p>
                      
                      <div className="flex gap-2 mt-4">
                        {qa.star_method_used && (
                          <span className="text-[10px] uppercase font-bold bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20">STAR Method Detected</span>
                        )}
                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${
                          qa.completeness === 'complete' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          qa.completeness === 'partial' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                           Answer Completeness: {qa.completeness.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </section>
        )}

        {/* 7. Prep Plan (60min only) */}
        {prepPlan && prepPlan.focus_topics?.length > 0 && (
           <section className="bg-gradient-to-br from-primary/10 to-secondary border border-primary/20 rounded-3xl p-8 shadow-xl relative overflow-hidden">
             
             <div className="relative z-10">
               <h2 className="text-2xl font-black tracking-tight mb-2">Your Personalised Prep Plan</h2>
               <p className="opacity-80 mb-8 max-w-2xl">Based on your deep-dive 60 minute interview, we've structured a roadmap to get you perfectly prepped for the real deal.</p>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                   <h3 className="font-bold text-sm uppercase tracking-widest mb-4 opacity-70">Focus Topics To Study</h3>
                   <div className="flex flex-wrap gap-2">
                     {prepPlan.focus_topics.map((t: string, i: number) => (
                       <span key={i} className="bg-background px-3 py-1.5 rounded-lg border border-border shadow-sm text-sm font-medium">{t}</span>
                     ))}
                   </div>
                 </div>
                 
                 <div>
                   <h3 className="font-bold text-sm uppercase tracking-widest mb-4 opacity-70">Question Types To Practise</h3>
                   <ul className="space-y-2">
                     {prepPlan.question_types_to_practice.map((q: string, i: number) => (
                       <li key={i} className="bg-background px-4 py-2 rounded-lg border border-border shadow-sm text-sm font-medium border-l-4 border-l-primary flex items-center before:content-[''] before:w-1.5 before:h-1.5 before:bg-primary before:rounded-full before:mr-3">{q}</li>
                     ))}
                   </ul>
                 </div>
               </div>
               
               <div className="mt-8 pt-6 border-t border-primary/20 flex items-center justify-between">
                 <span className="font-semibold px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm">Estimated Readiness Timeline: {prepPlan.estimated_ready_in}</span>
               </div>
             </div>
           </section>
        )}

      </main>
    </div>
  );
}
