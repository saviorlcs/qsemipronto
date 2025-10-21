// src/pages/Agenda.jsx
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Calendar as CalIcon,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  X,
} from "lucide-react";

/* ===================== helpers ===================== */
const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => d.toISOString().slice(0, 10);

/* ===================== HourPicker ===================== */
function HourPicker({ value, onChange }) {
  const [hh, mm] = (value || "00:00").split(":");
  return (
    <div className="flex items-center gap-1 w-full min-w-0">
      <Input
        type="number"
        min={0}
        max={23}
        value={Number(hh)}
        onChange={(e) => onChange(`${pad2(e.target.value || 0)}:${mm}`)}
        className="shrink-0 w-14 sm:w-16 bg-slate-700 border-slate-600 text-white"
      />
      <span className="text-slate-400 px-1">:</span>
      <Input
        type="number"
        min={0}
        max={59}
        value={Number(mm)}
        onChange={(e) => onChange(`${hh}:${pad2(e.target.value || 0)}`)}
        className="shrink-0 w-14 sm:w-16 bg-slate-700 border-slate-600 text-white"
      />
    </div>
  );
}


/* ===================== MonthGrid (calendário mensal) ===================== */
function buildMonthMatrix(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const startWeekday = (first.getDay() + 6) % 7; // seg=0
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function MonthGrid({ valueISO, onChange, monthSummary = {} }) {
  const sel = new Date(`${valueISO}T00:00:00`);
  const view = new Date(sel.getFullYear(), sel.getMonth(), 1);
  const weeks = buildMonthMatrix(view);

  const changeMonth = (delta) => {
    const d = new Date(view);
    d.setMonth(d.getMonth() + delta);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const chosen = Math.min(sel.getDate(), last);
    onChange(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(chosen)}`);
  };

  const monthLabel = view.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => changeMonth(-1)} className="text-gray-300 hover:text-white p-2 rounded-xl hover:bg-slate-800">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-white font-semibold capitalize">{monthLabel}</div>
        <button onClick={() => changeMonth(1)} className="text-gray-300 hover:text-white p-2 rounded-xl hover:bg-slate-800">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs text-slate-300 mb-1">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => (
          <div key={w} className="text-center opacity-80">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weeks.flat().map((d, i) => {
          if (!d) return <div key={i} className="h-12 rounded-xl bg-slate-800/30 border border-slate-800" />;
          const iso = `${view.getFullYear()}-${pad2(view.getMonth() + 1)}-${pad2(d)}`;
          const isSelected = iso === valueISO;
          const sum = monthSummary[iso];

          return (
            <button
              key={i}
              onClick={() => onChange(iso)}
              className={`h-12 rounded-xl border text-sm relative ${
                isSelected
                  ? "bg-cyan-600/20 border-cyan-500/40 text-white"
                  : "bg-slate-800/40 border-slate-700 text-slate-200 hover:bg-slate-800"
              }`}
            >
              <span className="absolute top-1 left-2 text-xs opacity-90">{d}</span>
              {!!sum?.count && (
                <span
                  title={`${sum.count} evento(s)`}
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${
                    sum?.hasCompleted ? "bg-emerald-400" : "bg-cyan-400"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== DayTimeline (linhas por hora) ===================== */
function DayTimeline({ events = [], subjects = [] }) {
  const startMin = 6 * 60;
  const endMin = 23 * 60;
  const total = endMin - startMin;
  const getSubj = (id) => subjects.find((s) => s.id === id);

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4 relative overflow-hidden">
      <div className="relative" style={{ height: 800 }}>
        {Array.from({ length: (endMin - startMin) / 60 + 1 }).map((_, i) => {
          const top = (i * 60) / total * 800;
          const hh = 6 + i;
          return (
            <div key={i} className="absolute left-0 right-0" style={{ top }}>
              <div className="flex items-center gap-3">
                <div className="w-14 text-right text-xs text-slate-400">{pad2(hh)}:00</div>
                <div className="flex-1 border-t border-slate-700/70" />
              </div>
            </div>
          );
        })}

        {events.map((ev) => {
          const s = new Date(ev.start);
          const e = new Date(ev.end);
          const sMin = s.getHours() * 60 + s.getMinutes();
          const eMin = e.getHours() * 60 + e.getMinutes();
          const top = ((sMin - startMin) / total) * 800;
          const height = Math.max(36, ((eMin - sMin) / total) * 800);
          const subj = getSubj(ev.subject_id);
          const hhmm = `${pad2(s.getHours())}:${pad2(s.getMinutes())} → ${pad2(e.getHours())}:${pad2(e.getMinutes())}`;

          return (
            <div
              key={ev.id}
              className="absolute left-20 right-6 rounded-xl p-3 shadow-md"
              style={{
                top,
                height,
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
                  <span
                    className="ml-1 text-xs px-2 py-0.5 rounded-lg"
                    style={{ color: "white", background: `${subj.color}30`, border: `1px solid ${subj.color}55` }}
                  >
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

/* ===================== Página Agenda ===================== */
export default function Agenda() {
  const [user, setUser] = useState(null);

  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [events, setEvents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [monthSummary, setMonthSummary] = useState({}); // {"YYYY-MM-DD": {count, hasCompleted}}

  // criação
  const [title, setTitle] = useState("");
  const [startHHMM, setStartHHMM] = useState("14:00");
  const [endHHMM, setEndHHMM] = useState("16:00");
  const [subjectId, setSubjectId] = useState("");
  const [creating, setCreating] = useState(false);

  // edição
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");

  const dateObj = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);

  function moveDay(delta) {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setSelectedDate(toISODate(d));
  }

  /* -------- carregar user e matérias -------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [me, subs] = await Promise.all([api.get("/auth/me"), api.get("/subjects")]);
        if (!alive) return;
        setUser(me.data || null);
        setSubjects(subs.data || []);
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* -------- buscar eventos do dia -------- */
  async function fetchDay() {
    try {
      const res = await api.get("/calendar/day", { params: { date_iso: selectedDate } });
      setEvents(res.data || []);
    } catch (e) {
      toast.error("Falha ao carregar eventos do dia");
    }
  }

  useEffect(() => {
    fetchDay();
  }, [selectedDate]);

  /* -------- resumo do mês -------- */
  async function fetchMonthSummary(iso) {
    const d = new Date(`${iso}T00:00:00`);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    try {
      const res = await api.get("/calendar/month", { params: { year: y, month: m } });
      const map = {};
      for (const it of res.data || []) map[it.date_iso] = { count: it.count, hasCompleted: !!it.hasCompleted };
      setMonthSummary(map);
    } catch {
      setMonthSummary({});
    }
  }

  useEffect(() => {
    fetchMonthSummary(selectedDate);
  }, [selectedDate]);

  /* -------- criar evento -------- */
  async function handleCreate() {
    if (!title.trim()) {
      toast.info("Dê um título ao evento 🙏");
      return;
    }
    const [sh, sm] = startHHMM.split(":").map(Number);
    const [eh, em] = endHHMM.split(":").map(Number);
    const start = new Date(`${selectedDate}T${pad2(sh)}:${pad2(sm)}:00`);
    const end = new Date(`${selectedDate}T${pad2(eh)}:${pad2(em)}:00`);
    if (end <= start) {
      toast.info("Hora final deve ser maior que a inicial");
      return;
    }
    setCreating(true);
    try {
      await api.post("/calendar/event", {
        title: title.trim(),
        start,
        end,
        subject_id: subjectId || null,
        checklist: [],
      });
      setTitle("");
      setSubjectId("");
      fetchDay();
      fetchMonthSummary(selectedDate);
      toast.success("Evento criado");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erro ao criar evento");
    } finally {
      setCreating(false);
    }
  }

  /* -------- deletar -------- */
  async function handleDelete(id) {
    try {
      await api.delete(`/calendar/event/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      fetchMonthSummary(selectedDate);
      toast.success("Evento removido");
    } catch {
      toast.error("Erro ao remover");
    }
  }

  /* -------- editar -------- */
  function startEdit(ev) {
    setEditingId(ev.id);
    setEditTitle(ev.title);
    setEditSubject(ev.subject_id || "");
  }

  async function saveEdit(id) {
    try {
      await api.patch(`/calendar/event/${id}`, {
        title: editTitle.trim(),
        subject_id: editSubject || null,
      });
      setEditingId(null);
      fetchDay();
      fetchMonthSummary(selectedDate);
      toast.success("Evento atualizado");
    } catch {
      toast.error("Erro ao salvar edição");
    }
  }

  /* -------- checklist -------- */
  async function addChecklistItem(id) {
    const text = prompt("Novo item do checklist:");
    if (!text || !text.trim()) return;
    try {
      await api.post(`/calendar/event/${id}/checklist`, { text: text.trim() });
      fetchDay();
    } catch {
      toast.error("Erro ao adicionar item");
    }
  }

  async function toggleChecklist(id, itemId) {
    try {
      await api.post(`/calendar/event/${id}/checklist/${itemId}/toggle`);
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id !== id
            ? ev
            : { ...ev, checklist: ev.checklist.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it)) }
        )
      );
    } catch {
      toast.error("Erro ao marcar item");
    }
  }

  /* ===================== render ===================== */
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <Header user={user} />

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Título + navegação do dia */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            <CalIcon className="inline w-8 h-8 mr-3 text-cyan-400" />
            Agenda
          </h1>

          <div className="flex items-center gap-2">
            <Button variant="ghost" className="text-gray-300 hover:text-white" onClick={() => moveDay(-1)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-white">
              {dateObj.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}
            </div>
            <Button variant="ghost" className="text-gray-300 hover:text-white" onClick={() => moveDay(1)}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ESQUERDA: calendário + criar */}
          <div className="lg:col-span-1 space-y-6">
            <MonthGrid valueISO={selectedDate} onChange={(iso) => setSelectedDate(iso)} monthSummary={monthSummary} />

           <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 backdrop-blur overflow-hidden">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" /> Novo evento
              </h2>

              <div className="space-y-4">
                <div>
                  <Label className="text-gray-300">Título</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Estudo de Farmacologia"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-300 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Início
                    </Label>
                    <HourPicker value={startHHMM} onChange={setStartHHMM} />
                  </div>
                  <div>
                    <Label className="text-gray-300 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Fim
                    </Label>
                    <HourPicker value={endHHMM} onChange={setEndHHMM} />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300">Matéria (opcional)</Label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl text-white px-3 py-2"
                  >
                    <option value="">— sem matéria —</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button onClick={handleCreate} disabled={creating} className="w-full bg-cyan-500 hover:bg-cyan-600">
                  {creating ? "Criando..." : "Adicionar"}
                </Button>
              </div>
            </div>
          </div>

          {/* DIREITA: timeline + cards */}
          <div className="lg:col-span-2 space-y-6">
            <DayTimeline events={events} subjects={subjects} />

            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4">
              {events.length === 0 ? (
                <div className="text-slate-300 p-8 text-center">Nada por aqui hoje. Que tal criar um evento? 🙂</div>
              ) : (
                <div className="space-y-4">
                  {events.map((ev) => {
                    const start = new Date(ev.start);
                    const end = new Date(ev.end);
                    const hhmm = `${pad2(start.getHours())}:${pad2(start.getMinutes())} → ${pad2(
                      end.getHours()
                    )}:${pad2(end.getMinutes())}`;
                    const subj = subjects.find((s) => s.id === ev.subject_id);
                    const isEditing = editingId === ev.id;

                    return (
                      <Card key={ev.id} className="bg-slate-900/60 border-slate-700 rounded-2xl p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {!isEditing ? (
                                <h3 className="text-white font-semibold text-lg">{ev.title}</h3>
                              ) : (
                                <Input
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="bg-slate-700 border-slate-600 text-white"
                                />
                              )}

                              {ev.completed && (
                                <span className="inline-flex items-center gap-1 text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-xl text-xs">
                                  <CheckCircle2 className="w-4 h-4" /> Concluído
                                </span>
                              )}

                              {subj && (
                                <span
                                  className="inline-flex items-center px-2 py-1 rounded-xl text-xs"
                                  style={{
                                    color: "white",
                                    background: `${subj.color}20`,
                                    border: `1px solid ${subj.color}55`,
                                  }}
                                >
                                  {subj.name}
                                </span>
                              )}
                            </div>

                            <div className="text-slate-300 mt-1 flex items-center gap-2">
                              <Clock className="w-4 h-4 text-cyan-300" />
                              <span>{hhmm}</span>
                            </div>

                            {ev.checklist?.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {ev.checklist.map((it) => (
                                  <label key={it.id} className="flex items-center gap-2 text-sm text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={!!it.done}
                                      onChange={() => toggleChecklist(ev.id, it.id)}
                                      className="accent-cyan-500"
                                    />
                                    <span className={it.done ? "line-through opacity-70" : ""}>{it.text}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            {!isEditing ? (
                              <>
                                <Button
                                  variant="secondary"
                                  className="bg-slate-800 hover:bg-slate-700 text-white"
                                  onClick={() => startEdit(ev)}
                                >
                                  <Edit2 className="w-4 h-4 mr-2" /> Editar
                                </Button>
                                <Button
                                  variant="destructive"
                                  className="bg-rose-600 hover:bg-rose-700"
                                  onClick={() => handleDelete(ev.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="text-cyan-300 hover:text-white"
                                  onClick={() => addChecklistItem(ev.id)}
                                >
                                  <ListChecks className="w-4 h-4 mr-2" /> Checklist
                                </Button>
                              </>
                            ) : (
                              <>
                                <div className="w-48">
                                  <Label className="text-gray-300 text-xs">Matéria (opcional)</Label>
                                  <select
                                    value={editSubject}
                                    onChange={(e) => setEditSubject(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-xl text-white px-3 py-2 mt-1"
                                  >
                                    <option value="">— sem matéria —</option>
                                    {subjects.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex gap-2">
                                  <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={() => saveEdit(ev.id)}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Salvar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="text-gray-300 hover:text-white"
                                    onClick={() => setEditingId(null)}
                                  >
                                    <X className="w-4 h-4 mr-2" /> Cancelar
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
