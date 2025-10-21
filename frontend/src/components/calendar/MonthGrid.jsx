import { ChevronLeft, ChevronRight } from "lucide-react";

const pad2 = (n) => String(n).padStart(2, "0");

function buildMonthMatrix(date) {
  // date = Date no primeiro dia do mês atual
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startWeekday = (first.getDay() + 6) % 7; // seg=0 ... dom=6
  const daysInMonth = new Date(date.getFullYear(), date.getMonth()+1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i+7));
  return weeks;
}

export default function MonthGrid({
  valueISO,            // "YYYY-MM-DD" selecionado
  onChange,            // (iso) => void
  monthSummary = {},   // { "YYYY-MM-DD": { count, hasCompleted } }
}) {
  const sel = new Date(`${valueISO}T00:00:00`);
  const view = new Date(sel.getFullYear(), sel.getMonth(), 1);
  const weeks = buildMonthMatrix(view);

  const changeMonth = (delta) => {
    const d = new Date(view);
    d.setMonth(d.getMonth() + delta);
    const iso = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-01`;
    // mantém o dia selecionado, se existir no novo mês
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    const chosenDay = Math.min(sel.getDate(), last);
    onChange(`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(chosenDay)}`);
  };

  const monthLabel = view.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => changeMonth(-1)} className="text-gray-300 hover:text-white p-2 rounded-xl hover:bg-slate-800">
          <ChevronLeft className="w-5 h-5"/>
        </button>
        <div className="text-white font-semibold capitalize">{monthLabel}</div>
        <button onClick={() => changeMonth(1)} className="text-gray-300 hover:text-white p-2 rounded-xl hover:bg-slate-800">
          <ChevronRight className="w-5 h-5"/>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs text-slate-300 mb-1">
        {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((w)=>(
          <div key={w} className="text-center opacity-80">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weeks.flat().map((d, i) => {
          if (!d) return <div key={i} className="h-12 rounded-xl bg-slate-800/30 border border-slate-800"/>;
          const iso = `${view.getFullYear()}-${pad2(view.getMonth()+1)}-${pad2(d)}`;
          const isSelected = iso === valueISO;
          const sum = monthSummary[iso];

          return (
            <button
              key={i}
              onClick={() => onChange(iso)}
              className={`h-12 rounded-xl border text-sm relative
                ${isSelected ? "bg-cyan-600/20 border-cyan-500/40 text-white" : "bg-slate-800/40 border-slate-700 text-slate-200 hover:bg-slate-800"}
              `}
            >
              <span className="absolute top-1 left-2 text-xs opacity-90">{d}</span>

              {/* pontinho indicando eventos no dia */}
              {!!sum?.count && (
                <span
                  title={`${sum.count} evento(s)`}
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full
                    ${sum?.hasCompleted ? "bg-emerald-400" : "bg-cyan-400"}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
