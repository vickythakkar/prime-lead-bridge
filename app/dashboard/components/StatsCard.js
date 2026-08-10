export default function StatsCard({ title, value, trend, trendUp }) {
  return (
    <div className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-indigo-500/20 transition-all" />
      
      <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
      <div className="flex items-end gap-3">
        <span className="text-4xl font-bold text-white tracking-tight">{value}</span>
        {trend && (
          <span className={`text-sm font-medium mb-1 ${trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
    </div>
  );
}
