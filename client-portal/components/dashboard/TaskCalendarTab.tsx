"use client";

import { useState, useMemo } from "react";
import type { Task } from "@/lib/types";

interface Props {
  tasks: Task[];
}

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  "scheduled":       { bg: "bg-slate-100",  text: "text-slate-600",  border: "border-slate-200",  dot: "bg-slate-400",  label: "Scheduled" },
  "yet to start":    { bg: "bg-sky-100",    text: "text-sky-700",    border: "border-sky-200",    dot: "bg-sky-400",    label: "Yet to Start" },
  "in progress":     { bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200",   dot: "bg-blue-500",   label: "In Progress" },
  "awaiting client": { bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200",  dot: "bg-amber-400",  label: "Awaiting Client" },
  "review required": { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500", label: "Review Required" },
  "overdue":         { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200",    dot: "bg-red-500",    label: "Overdue" },
  "blocked":         { bg: "bg-rose-100",   text: "text-rose-800",   border: "border-rose-200",   dot: "bg-rose-600",   label: "Blocked" },
  "complete":        { bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200",  dot: "bg-green-500",  label: "Complete" },
};
const DEFAULT_STATUS = { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200", dot: "bg-gray-400", label: "Unknown" };
function getStatus(s: string | null) { return s ? (STATUS_CONFIG[s.toLowerCase()] ?? DEFAULT_STATUS) : DEFAULT_STATUS; }

// ─── Responsibility colors ──────────────────────────────────────────────────

const RESPONSIBILITY_CONFIG: Record<string, { bg: string; text: string }> = {
  "sympl team":        { bg: "bg-blue-50",   text: "text-blue-700" },
  "bookkeeping team":  { bg: "bg-violet-50", text: "text-violet-700" },
  "client":            { bg: "bg-amber-50",  text: "text-amber-700" },
  "client/sympl team": { bg: "bg-teal-50",   text: "text-teal-700" },
};
function getResponsibility(r: string | null) {
  if (!r) return null;
  return RESPONSIBILITY_CONFIG[r.toLowerCase()] ?? { bg: "bg-gray-50", text: "text-gray-600" };
}

// ─── Task Type colors ───────────────────────────────────────────────────────

const TASK_TYPE_CONFIG: Record<string, { bg: string; text: string }> = {
  "bookkeeping":               { bg: "bg-blue-50",    text: "text-blue-700" },
  "payroll":                   { bg: "bg-green-50",   text: "text-green-700" },
  "ap/expense":                { bg: "bg-orange-50",  text: "text-orange-700" },
  "reporting":                 { bg: "bg-purple-50",  text: "text-purple-700" },
  "compliance":                { bg: "bg-red-50",     text: "text-red-700" },
  "client profile":            { bg: "bg-slate-50",   text: "text-slate-600" },
  "financial systems":         { bg: "bg-cyan-50",    text: "text-cyan-700" },
  "schedules & calendar":      { bg: "bg-indigo-50",  text: "text-indigo-700" },
  "missing transaction weekly":{ bg: "bg-rose-50",    text: "text-rose-700" },
};
function getTaskType(t: string | null) {
  if (!t) return null;
  return TASK_TYPE_CONFIG[t.toLowerCase()] ?? { bg: "bg-gray-50", text: "text-gray-600" };
}

// ─── Cadence colors ─────────────────────────────────────────────────────────

const CADENCE_CONFIG: Record<string, { bg: string; text: string }> = {
  "daily":        { bg: "bg-red-50",    text: "text-red-600" },
  "weekly":       { bg: "bg-orange-50", text: "text-orange-600" },
  "biweekly":     { bg: "bg-amber-50",  text: "text-amber-600" },
  "semi-monthly": { bg: "bg-yellow-50", text: "text-yellow-700" },
  "monthly":      { bg: "bg-blue-50",   text: "text-blue-600" },
  "quarterly":    { bg: "bg-purple-50", text: "text-purple-600" },
  "annual":       { bg: "bg-green-50",  text: "text-green-600" },
  "n/a":          { bg: "bg-gray-50",   text: "text-gray-500" },
};
function getCadence(c: string | null) {
  if (!c) return null;
  return CADENCE_CONFIG[c.toLowerCase()] ?? { bg: "bg-gray-50", text: "text-gray-500" };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toDateKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }

function startOfWeek(d: Date) {
  const c = new Date(d);
  c.setDate(c.getDate() - c.getDay());
  c.setHours(0,0,0,0);
  return c;
}
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }

// ─── Task chip (3-line) ─────────────────────────────────────────────────────

function TaskChip({ task, onClick }: { task: Task; onClick: () => void }) {
  const s = getStatus(task.status);
  const cadStyle  = getCadence(task.cadence);
  const typeStyle = getTaskType(task.taskType);
  const respStyle = getResponsibility(task.responsibility);
  const totalPoints = task.checklist?.length ?? 0;
  const completedPoints = task.checklist?.filter(c => c.resolved).length ?? 0;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-full text-left px-2 py-1.5 rounded border ${s.bg} ${s.border} hover:brightness-95 transition`}
    >
      <p className={`text-xs font-semibold leading-snug truncate ${s.text}`}>{task.name}</p>
      {(task.cadence || task.taskType) && (
        <div className="mt-0.5 flex gap-1 overflow-hidden">
          {task.cadence && cadStyle && (
            <span className={`text-[11px] leading-snug font-medium px-1.5 py-0.5 rounded truncate min-w-0 ${cadStyle.bg} ${cadStyle.text}`}>
              {task.cadence}
            </span>
          )}
          {task.taskType && typeStyle && (
            <span className={`text-[11px] leading-snug font-medium px-1.5 py-0.5 rounded truncate min-w-0 ${typeStyle.bg} ${typeStyle.text}`}>
              {task.taskType}
            </span>
          )}
        </div>
      )}
      {(task.responsibility || totalPoints > 0) && (
        <div className="mt-0.5 flex items-center gap-1 overflow-hidden">
          {task.responsibility && respStyle && (
            <span className={`text-[11px] leading-snug font-medium px-1.5 py-0.5 rounded truncate min-w-0 ${respStyle.bg} ${respStyle.text}`}>
              {task.responsibility}
            </span>
          )}
          {totalPoints > 0 && (
            <span className="text-[11px] leading-snug font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
              {completedPoints}/{totalPoints} pts
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Colored badge ──────────────────────────────────────────────────────────

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

// ─── Detail sidebar ─────────────────────────────────────────────────────────

function DetailSidebar({ task, onClose }: { task: Task | null; onClose: () => void }) {
  if (!task) return null;
  const s = getStatus(task.status);
  const dueDate = task.dueDate ? new Date(task.dueDate.toMillis()) : null;
  const completedItems = task.checklist.filter(c => c.resolved).length;
  const respStyle = getResponsibility(task.responsibility);
  const typeStyle = getTaskType(task.taskType);
  const cadStyle  = getCadence(task.cadence);

  return (
    <>
      <div className="fixed inset-0 bg-black/25 z-40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* Decorative banner */}
        <div className="relative h-32 bg-[#1a1a2e] shrink-0 overflow-hidden">
          <div className="absolute inset-0"
            style={{ backgroundImage: "radial-gradient(circle at 15% 60%, #4f8ef7 0%, transparent 45%), radial-gradient(circle at 85% 20%, #7c3aed 0%, transparent 40%), radial-gradient(circle at 50% 110%, #06b6d4 0%, transparent 50%)" }}
          />
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          {/* Close button */}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Status dot */}
          <div className="absolute bottom-4 left-6 flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full border-2 border-white/40 ${s.dot}`} />
            <span className={`text-sm font-medium px-3 py-1 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
              {s.label}
            </span>
          </div>
        </div>

        {/* Task title block */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#1a1a2e] leading-snug">{task.name}</h2>
          {(task.responsibility || task.cadence) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {respStyle && task.responsibility && (
                <Badge label={task.responsibility} bg={respStyle.bg} text={respStyle.text} />
              )}
              {cadStyle && task.cadence && (
                <Badge label={task.cadence} bg={cadStyle.bg} text={cadStyle.text} />
              )}
              {typeStyle && task.taskType && (
                <Badge label={task.taskType} bg={typeStyle.bg} text={typeStyle.text} />
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-10 space-y-6">

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</p>
              <p className="text-base text-gray-600 leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Detail fields */}
          <div>
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Details</p>
            <div className="grid grid-cols-2 gap-3">
              {dueDate && (
                <DetailField label="Due Date"
                  value={dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
              )}
              {task.workMonth && task.workYear && (
                <DetailField label="Period" value={`${task.workMonth} ${task.workYear}`} />
              )}
              {task.cadence && cadStyle && (
                <div className={`rounded-xl px-4 py-3 ${cadStyle.bg}`}>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Cadence</p>
                  <span className={`text-sm font-semibold ${cadStyle.text}`}>{task.cadence}</span>
                </div>
              )}
              {task.taskType && typeStyle && (
                <div className={`rounded-xl px-4 py-3 ${typeStyle.bg}`}>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Task Type</p>
                  <span className={`text-sm font-semibold ${typeStyle.text}`}>{task.taskType}</span>
                </div>
              )}
              {task.responsibility && respStyle && (
                <div className={`rounded-xl px-4 py-3 ${respStyle.bg}`}>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Responsibility</p>
                  <span className={`text-sm font-semibold ${respStyle.text}`}>{task.responsibility}</span>
                </div>
              )}
              {task.approvalRequired && (
                <DetailField label="Approval" value="Required" valueClass="text-amber-600 font-semibold" />
              )}
            </div>
          </div>

          {/* Checklist */}
          {task.checklist.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Checklist</p>
                <span className="text-sm text-gray-400">{completedItems} / {task.checklist.length} done</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
                <div
                  className="h-full bg-[#1a1a2e] rounded-full transition-all"
                  style={{ width: `${task.checklist.length > 0 ? (completedItems / task.checklist.length) * 100 : 0}%` }}
                />
              </div>
              <div className="space-y-3">
                {task.checklist
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map(item => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        item.resolved ? "bg-[#1a1a2e] border-[#1a1a2e]" : "border-gray-300"
                      }`}>
                        {item.resolved && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-base leading-snug ${item.resolved ? "line-through text-gray-400" : "text-gray-600"}`}>
                        {item.name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DetailField({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
      <p className={`text-sm font-semibold text-[#1a1a2e] ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

// ─── Legend ─────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {Object.values(STATUS_CONFIG).map(s => (
        <div key={s.label} className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${s.dot}`} />
          <span className="text-xs text-gray-500">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Month view ─────────────────────────────────────────────────────────────

function MonthView({ year, month, tasksByDay, todayKey, onSelectTask }: {
  year: number; month: number;
  tasksByDay: Map<string, Task[]>;
  todayKey: string;
  onSelectTask: (t: Task) => void;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      {/* Sticky day headers */}
      <div className="sticky top-0 z-10 bg-white grid grid-cols-7 border-b border-gray-100 rounded-t-2xl">
        {DAY_NAMES.map(d => (
          <div key={d} className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="min-h-32 bg-gray-50/40" />;
          const key = toDateKey(new Date(year, month, day));
          const dayTasks = tasksByDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={day} className={`min-h-32 p-1.5 flex flex-col gap-1 ${isToday ? "bg-blue-50/50" : "hover:bg-gray-50/60"} transition`}>
              <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
                isToday ? "bg-[#1a1a2e] text-white" : "text-gray-500"
              }`}>
                {day}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayTasks.map(task => (
                  <TaskChip key={task.taskId} task={task} onClick={() => onSelectTask(task)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week view ──────────────────────────────────────────────────────────────

function WeekView({ weekStart, tasksByDay, todayKey, onSelectTask }: {
  weekStart: Date;
  tasksByDay: Map<string, Task[]>;
  todayKey: string;
  onSelectTask: (t: Task) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      {/* Sticky day + date header */}
      <div className="sticky top-0 z-10 bg-white rounded-t-2xl grid grid-cols-7 divide-x divide-gray-100 border-b border-gray-100">
        {days.map(day => {
          const key = toDateKey(day);
          const isToday = key === todayKey;
          return (
            <div key={`h-${key}`} className={`py-3 text-center ${isToday ? "bg-blue-50/50" : ""}`}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {DAY_NAMES[day.getDay()]}
              </p>
              <div className={`mx-auto mt-1 w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${
                isToday ? "bg-[#1a1a2e] text-white" : "text-gray-700"
              }`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      {/* Task columns */}
      <div className="grid grid-cols-7 divide-x divide-gray-100">
        {days.map(day => {
          const key = toDateKey(day);
          const dayTasks = tasksByDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={key} className={`p-2 flex flex-col gap-1.5 min-h-40 ${isToday ? "bg-blue-50/20" : ""}`}>
              {dayTasks.length === 0 && (
                <p className="text-[10px] text-gray-300 text-center mt-4">—</p>
              )}
              {dayTasks.map(task => (
                <TaskChip key={task.taskId} task={task} onClick={() => onSelectTask(task)} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

type ViewMode = "month" | "week";

const CADENCE_OPTIONS = ["Daily", "Weekly", "Biweekly", "Semi-monthly", "Monthly", "Quarterly", "Annual"] as const;

export default function TaskCalendarTab({ tasks }: Props) {
  const today = new Date();
  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth());
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const [view, setView]           = useState<ViewMode>("month");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterCadence, setFilterCadence] = useState<string | null>(null);

  function prevPeriod() {
    if (view === "month") {
      if (month === 0) { setMonth(11); setYear(y => y - 1); }
      else setMonth(m => m - 1);
    } else {
      setWeekStart(w => addDays(w, -7));
    }
  }
  function nextPeriod() {
    if (view === "month") {
      if (month === 11) { setMonth(0); setYear(y => y + 1); }
      else setMonth(m => m + 1);
    } else {
      setWeekStart(w => addDays(w, 7));
    }
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setWeekStart(startOfWeek(today));
  }

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      if (filterCadence && task.cadence?.toLowerCase() !== filterCadence.toLowerCase()) continue;
      const key = toDateKey(new Date(task.dueDate.toMillis()));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks, filterCadence]);

  const todayKey = toDateKey(today);
  const weekEnd  = addDays(weekStart, 6);

  const headerLabel = view === "month"
    ? `${MONTH_NAMES[month]} ${year}`
    : `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="space-y-4 w-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#1a1a2e] transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-base font-semibold text-[#1a1a2e] min-w-48 text-center">{headerLabel}</h2>
          <button onClick={nextPeriod} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#1a1a2e] transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-[#1a1a2e] hover:bg-gray-100 rounded-lg border border-gray-200 transition">
            Today
          </button>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {(["month", "week"] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition capitalize ${
                view === v ? "bg-white text-[#1a1a2e] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Cadence filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-400 shrink-0">Cadence:</span>
        <button
          onClick={() => setFilterCadence(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
            filterCadence === null
              ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
          }`}
        >
          All
        </button>
        {CADENCE_OPTIONS.map(c => {
          const style = getCadence(c);
          const active = filterCadence === c;
          return (
            <button
              key={c}
              onClick={() => setFilterCadence(active ? null : c)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                active
                  ? `${style?.bg ?? "bg-gray-100"} ${style?.text ?? "text-gray-600"} border-current ring-1 ring-current`
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <Legend />

      {/* Calendar */}
      {view === "month" ? (
        <MonthView year={year} month={month} tasksByDay={tasksByDay} todayKey={todayKey} onSelectTask={setSelectedTask} />
      ) : (
        <WeekView weekStart={weekStart} tasksByDay={tasksByDay} todayKey={todayKey} onSelectTask={setSelectedTask} />
      )}

      {/* Sidebar */}
      <DetailSidebar task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
