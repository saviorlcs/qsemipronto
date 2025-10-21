const pad2 = (n)=>String(n).padStart(2,"0");

export default function DayTimeline({ events = [], subjects = [] }) {
  // timeline de 06:00 às 23:00
  const startMin = 6*60, endMin = 23*60;
  const total = endMin - startMin;

  const getSubj = (id)=> subjects.find(s=>s.id===id);

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4 relative overflow-hidden">
      <div className="relative" style={{ height: 800 }}>
        {/* linhas de hora */}
        {Array.from({length: (endMin-startMin)/60 + 1}).map((_,i)=>{
          const top = (i*60)/total*800;
          const hh = 6+i;
          return (
            <div key={i} className="absolute left-0 right-0" style={{ top }}>
              <div className="flex items-center gap-3">
                <div className="w-14 text-right text-xs text-slate-400">{pad2(hh)}:00</div>
                <div className="flex-1 border-t border-slate-700/70"/>
              </div>
            </div>
          );
        })}

        {/* blocos de evento */}
        {events.map(ev=>{
          const s = new Date(ev.start), e = new Date(ev.end);
          const sMin = s.getHours()*60 + s.getMinutes();
          const eMin = e.getHours()*60 + e.getMinutes();
          const top = ((sMin - startMin)/total)*800;
          const height = Math.max(36, ((eMin - sMin)/total)*800); // mínimo 36px
          const subj = getSubj(ev.subject_id);
          const hhmm = `${pad2(s.getHours())}:${pad2(s.getMinutes())} → ${pad2(e.getHours())}:${pad2(e.getMinutes())}`;

          return (
            <div key={ev.id}
              className="absolute left-20 right-6 rounded-xl p-3 shadow-md"
              style={{
                top, height,
                background: subj ? `${subj.color}22` : "rgba(14,165,233,.12)",
                border: `1px solid ${subj ? `${subj.color}55` : "rgba(14,165,233,.35)"}`,
              }}
            >
              <div className="flex items-center gap-2 text-sm text-white font-medium">
                <span className="truncate">{ev.title}</span>
                {ev.completed && (
                  <span className="ml-1 text-emerald-300 text-xs bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                    Concluído
                  </span>
                )}
                {subj && (
                  <span className="ml-1 text-xs px-2 py-0.5 rounded-lg" style={{
                    color: "white", background: `${subj.color}30`, border: `1px solid ${subj.color}55`
                  }}>
                    {subj.name}
                  </span>
                )}
              </div>
              <div className="text-slate-300 text-xs mt-1">{hhmm}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
