(function exposePlanning(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AsteriaPlanning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  function toMinutes(value) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function toTime(value) {
    const minutes = Math.max(0, Math.min(1439, Math.round(Number(value) || 0)));
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  function durationOf(value) {
    return Math.min(240, Math.max(5, Math.round((Number(value) || 25) / 5) * 5));
  }

  function activeIntervals(items, date) {
    return (Array.isArray(items) ? items : []).filter((item) => item && !item.done && (!date || item.date === date)).map((item) => {
      const start = toMinutes(item.time);
      if (start === null) return null;
      return { id: item.id, start, end: start + durationOf(item.duration) };
    }).filter(Boolean).sort((a, b) => a.start - b.start || a.end - b.end);
  }

  function conflictIds(items, date) {
    const intervals = activeIntervals(items, date);
    const conflicts = new Set();
    for (let left = 0; left < intervals.length; left += 1) {
      for (let right = left + 1; right < intervals.length; right += 1) {
        if (intervals[right].start >= intervals[left].end) break;
        if (intervals[left].start < intervals[right].end) {
          conflicts.add(intervals[left].id);
          conflicts.add(intervals[right].id);
        }
      }
    }
    return [...conflicts];
  }

  function candidateScore(task, date) {
    const priority = { high: 300, medium: 200, low: 100 }[task.priority] || 100;
    if (!task.due) return priority;
    if (task.due < date) return priority + 1000;
    if (task.due === date) return priority + 500;
    return priority;
  }

  function autoPlan({ tasks = [], planItems = [], date, startMinute = 9 * 60, endMinute = 22 * 60, maxItems = 3 } = {}) {
    if (!date || endMinute <= startMinute || maxItems <= 0) return [];
    const linked = new Set(planItems.filter((item) => item?.date === date && item.taskId).map((item) => item.taskId));
    const candidates = tasks.filter((task) => task && !task.done && task.status !== 'waiting' && !linked.has(task.id)).sort((a, b) => candidateScore(b, date) - candidateScore(a, date) || String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    const occupied = activeIntervals(planItems, date).map(({ start, end }) => ({ start, end }));
    const generated = [];

    for (const task of candidates) {
      if (generated.length >= maxItems) break;
      const duration = durationOf(task.estimatedMinutes);
      let cursor = startMinute;
      let slot = null;
      occupied.sort((a, b) => a.start - b.start || a.end - b.end);
      for (const interval of occupied) {
        if (interval.end <= cursor) continue;
        if (interval.start - cursor >= duration) { slot = cursor; break; }
        cursor = Math.max(cursor, interval.end);
      }
      if (slot === null && endMinute - cursor >= duration) slot = cursor;
      if (slot === null || slot + duration > endMinute) continue;
      generated.push({ taskId: task.id, title: task.title, time: toTime(slot), duration });
      occupied.push({ start: slot, end: slot + duration });
    }
    return generated;
  }

  return { toMinutes, toTime, durationOf, conflictIds, autoPlan };
});
