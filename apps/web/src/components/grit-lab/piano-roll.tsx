"use client";

import { useCallback, useEffect, useRef } from "react";
import { PITCH_MAX, PITCH_MIN, noteName, type Note, type Stage } from "@voxilizer/engine";
import { clampMove, newNoteId, STEPS_PER_BAR } from "./notes";
import { cssVar } from "./scopes";
import { useGritLab } from "./store";

const KEY_W = 46;
const STEP_W = 20;
const ROW_H = 14;
const ROWS = PITCH_MAX - PITCH_MIN + 1;
const EDGE_PX = 7;
const STAGE_VAR = ["--stage-clean", "--stage-clean", "--stage-2", "--stage-3", "--stage-4"] as const;
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

type Drag =
  | { type: "resize"; id: string; startStep: number; origLength: number; created: boolean }
  | {
      type: "move";
      startStep: number;
      startPitch: number;
      orig: { id: string; start: number; pitch: number }[];
    };

interface PianoRollProps {
  noteStages: Record<string, Stage>;
  /** Current playback position in grid steps, or -1. */
  playStep: number;
  /** Called with a short list of notes to audition (e.g. a note just placed). */
  onAudition: (notes: Note[]) => void;
}

/**
 * Canvas piano roll. Click empty space to add a note, drag a note to move it,
 * drag its right edge to resize, Shift-click to multi-select.
 * Keyboard (when focused): Delete removes, arrows move by a step or semitone.
 * While dragging, edits live in a local draft and are committed as one undo step.
 */
export function PianoRoll({ noteStages, playStep, onAudition }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<Note[] | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const movedRef = useRef(false);

  const notes = useGritLab((s) => s.song.notes);
  const bars = useGritLab((s) => s.song.bars);
  const selection = useGritLab((s) => s.selection);
  const totalSteps = bars * STEPS_PER_BAR;

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const w = KEY_W + totalSteps * STEP_W,
      h = ROWS * ROW_H,
      r = window.devicePixelRatio || 1;
    if (c.width !== Math.floor(w * r)) {
      c.width = Math.floor(w * r);
      c.height = Math.floor(h * r);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    const g = c.getContext("2d")!;
    g.setTransform(r, 0, 0, r, 0, 0);
    const v = (n: string) => cssVar(c, n);
    const ink = v("--foreground"),
      muted = v("--muted-foreground"),
      line = v("--border"),
      panel = v("--card"),
      scope = v("--scope"),
      acc = v("--primary"),
      accInk = v("--primary-foreground");
    const sel = new Set(selection);
    const list = draftRef.current ?? notes;

    g.clearRect(0, 0, w, h);
    g.font = `10px ${v("--font-mono") || "monospace"}`;
    for (let row = 0; row < ROWS; row++) {
      const midi = PITCH_MAX - row,
        black = BLACK_KEYS.has(midi % 12);
      g.fillStyle = black ? scope : panel;
      g.fillRect(KEY_W, row * ROW_H, w - KEY_W, ROW_H);
      g.fillStyle = black ? line : panel;
      g.fillRect(0, row * ROW_H, KEY_W, ROW_H);
      if (midi % 12 === 0 || midi % 12 === 9) {
        g.fillStyle = muted;
        g.textAlign = "left";
        g.fillText(noteName(midi), 4, row * ROW_H + 10.5);
      }
      if ((midi + 1) % 12 === 0) {
        g.strokeStyle = line;
        g.beginPath();
        g.moveTo(0, row * ROW_H + 0.5);
        g.lineTo(w, row * ROW_H + 0.5);
        g.stroke();
      }
    }
    for (let s = 0; s <= totalSteps; s++) {
      const x = KEY_W + s * STEP_W + 0.5;
      g.globalAlpha = s % 16 === 0 ? 0.9 : s % 4 === 0 ? 0.55 : 0.2;
      g.strokeStyle = s % 16 === 0 ? muted : line;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.strokeStyle = line;
    g.beginPath();
    g.moveTo(KEY_W + 0.5, 0);
    g.lineTo(KEY_W + 0.5, h);
    g.stroke();

    for (const n of list) {
      const x = KEY_W + n.start * STEP_W + 1,
        y = (PITCH_MAX - n.pitch) * ROW_H + 1,
        wd = n.length * STEP_W - 2,
        ht = ROW_H - 2;
      g.globalAlpha = 0.9;
      g.fillStyle = acc;
      g.beginPath();
      g.roundRect(x, y, wd, ht, 3);
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = v(STAGE_VAR[noteStages[n.id] ?? 0]);
      g.fillRect(x, y + ht - 3, wd, 3);
      if (sel.has(n.id)) {
        g.strokeStyle = ink;
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(x, y, wd, ht, 3);
        g.stroke();
        g.lineWidth = 1;
      }
      g.fillStyle = accInk;
      g.font = `600 10px ${v("--font-mono") || "monospace"}`;
      g.textAlign = "left";
      if (wd > 10) g.fillText(n.vowel, x + 3, y + 9.5);
      if (n.tone && wd > 22) {
        g.beginPath();
        g.arc(x + wd - 5, y + 5, 2.5, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (playStep >= 0) {
      const x = KEY_W + playStep * STEP_W;
      g.strokeStyle = v("--stage-4");
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
      g.lineWidth = 1;
    }
  }, [totalSteps, noteStages, playStep, notes, selection]);

  useEffect(() => {
    draw();
    const mo = new MutationObserver(draw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, [draw]);

  // Start scrolled to the middle of the range.
  useEffect(() => {
    if (wrapRef.current) wrapRef.current.scrollTop = Math.max(0, (PITCH_MAX - 64) * ROW_H - 40);
  }, []);

  function cellAt(e: React.PointerEvent) {
    const rc = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rc.left,
      y = e.clientY - rc.top;
    return { x, step: Math.floor((x - KEY_W) / STEP_W), pitch: PITCH_MAX - Math.floor(y / ROW_H) };
  }
  const hit = (list: Note[], step: number, pitch: number) =>
    list.find((n) => n.pitch === pitch && step >= n.start && step < n.start + n.length);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = cellAt(e);
    if (c.x < KEY_W || c.step >= totalSteps || c.pitch < PITCH_MIN || c.pitch > PITCH_MAX) return;
    canvasRef.current!.focus();
    canvasRef.current!.setPointerCapture(e.pointerId);
    const st = useGritLab.getState();
    const list = st.song.notes.map((n) => ({ ...n }));
    const found = hit(list, c.step, c.pitch);
    let sel = new Set(st.selection);
    movedRef.current = false;

    if (found) {
      const onEdge = KEY_W + (found.start + found.length) * STEP_W - c.x < EDGE_PX;
      if (e.shiftKey) {
        if (sel.has(found.id)) sel.delete(found.id);
        else sel.add(found.id);
      } else if (!sel.has(found.id)) sel = new Set([found.id]);
      dragRef.current = onEdge
        ? { type: "resize", id: found.id, startStep: c.step, origLength: found.length, created: false }
        : {
            type: "move",
            startStep: c.step,
            startPitch: c.pitch,
            orig: list
              .filter((n) => sel.has(n.id))
              .map((n) => ({ id: n.id, start: n.start, pitch: n.pitch })),
          };
    } else {
      if (!e.shiftKey) sel.clear();
      const n: Note = {
        id: newNoteId(),
        pitch: c.pitch,
        start: c.step,
        length: Math.min(st.newLength, totalSteps - c.step),
        vowel: st.newVowel,
        tone: null,
      };
      list.push(n);
      sel.add(n.id);
      dragRef.current = { type: "resize", id: n.id, startStep: c.step, origLength: n.length, created: true };
    }
    draftRef.current = list;
    st.setSelection([...sel]);
    draw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = cellAt(e);
    const drag = dragRef.current,
      list = draftRef.current;
    if (!drag || !list) {
      const found = hit(useGritLab.getState().song.notes, c.step, c.pitch);
      e.currentTarget.style.cursor = found
        ? KEY_W + (found.start + found.length) * STEP_W - c.x < EDGE_PX
          ? "ew-resize"
          : "grab"
        : "crosshair";
      return;
    }
    if (drag.type === "resize") {
      const n = list.find((x) => x.id === drag.id)!;
      const len = Math.max(1, Math.min(totalSteps - n.start, drag.origLength + (c.step - drag.startStep)));
      if (len !== n.length) {
        n.length = len;
        movedRef.current = true;
      }
    } else {
      const group = drag.orig.map((o) => ({
        ...list.find((x) => x.id === o.id)!,
        start: o.start,
        pitch: o.pitch,
      }));
      const { dStep, dPitch } = clampMove(
        group,
        c.step - drag.startStep,
        c.pitch - drag.startPitch,
        totalSteps,
      );
      for (const o of drag.orig) {
        const n = list.find((x) => x.id === o.id)!;
        n.start = o.start + dStep;
        n.pitch = o.pitch + dPitch;
      }
      if (dStep || dPitch) movedRef.current = true;
    }
    draw();
  }

  function onPointerUp() {
    const drag = dragRef.current,
      list = draftRef.current;
    dragRef.current = null;
    draftRef.current = null;
    if (!drag || !list) return;
    const st = useGritLab.getState();
    if (drag.type === "resize" && drag.created) {
      const n = list.find((x) => x.id === drag.id)!;
      st.addNote(n);
      onAudition([{ ...n, start: 0, length: Math.min(n.length, 4) }]);
    } else if (movedRef.current) {
      st.commitNotes(list);
      if (drag.type === "move" && drag.orig.length === 1) {
        const n = list.find((x) => x.id === drag.orig[0]!.id)!;
        onAudition([{ ...n, start: 0, length: Math.min(n.length, 4) }]);
      }
    } else draw();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const st = useGritLab.getState();
    if (!st.selection.length) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      st.deleteSelected();
      return;
    }
    const dPitch = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
    const dStep = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dPitch && !dStep) return;
    e.preventDefault();
    const sel = new Set(st.selection);
    const group = st.song.notes.filter((n) => sel.has(n.id));
    const m = clampMove(group, dStep, dPitch, totalSteps);
    if (m.dStep !== dStep || m.dPitch !== dPitch) return;
    st.commitNotes(
      st.song.notes.map((n) =>
        sel.has(n.id) ? { ...n, start: n.start + dStep, pitch: n.pitch + dPitch } : n,
      ),
    );
  }

  return (
    <div ref={wrapRef} className="max-h-96 overflow-auto rounded-lg border bg-scope">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-label="Piano roll. Click to add a note, drag to move it, drag its right edge to resize, Shift-click to select several. Delete removes selected notes; arrow keys move them."
        className="block max-w-none touch-none focus-visible:outline-2 focus-visible:-outline-offset-2"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
