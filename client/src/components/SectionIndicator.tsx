interface SectionIndicatorProps {
  section: string;
}

const SectionIndicator: React.FC<SectionIndicatorProps> = ({ section }) => {
  return (
    <div className="h-12 flex flex-col justify-center items-center px-4 bg-background/40 border-b border-border/50 backdrop-blur-sm transition-all duration-500">
      <div className="flex items-center space-x-3">
        <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
        <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
          Current Evaluation Phase: <span className="text-primary ml-1">{section}</span>
        </span>
      </div>
    </div>
  );
};

export default SectionIndicator;
