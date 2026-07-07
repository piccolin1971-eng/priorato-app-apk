import { useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { it } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { dateToIso, formatDateIt, isoToDate, parseDateIt } from "../utils";

type Props = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
};

export function DateInput({ label, value, onChange }: Props) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => formatDateIt(value));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setText(formatDateIt(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function commitText(raw: string) {
    const iso = parseDateIt(raw);
    if (iso) {
      onChange(iso);
      setText(formatDateIt(iso));
      return true;
    }
    return false;
  }

  function pickDate(date: Date | undefined) {
    if (!date) return;
    const iso = dateToIso(date);
    onChange(iso);
    setText(formatDateIt(iso));
    setOpen(false);
  }

  return (
    <label className="date-input" htmlFor={id}>
      {label}
      <div className="date-input-wrap" ref={wrapRef}>
        <div className="date-input-row">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            className="date-text"
            placeholder="gg/mm/aaaa"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if (!commitText(text)) setText(formatDateIt(value));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!commitText(text)) setText(formatDateIt(value));
              }
            }}
          />
          <button
            type="button"
            className={`btn date-cal${open ? " active" : ""}`}
            title="Apri calendario"
            aria-label={`Calendario ${label}`}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            📅
          </button>
        </div>

        {open && (
          <div className="date-popover" role="dialog" aria-label={`Calendario ${label}`}>
            <DayPicker
              mode="single"
              locale={it}
              weekStartsOn={1}
              selected={isoToDate(value)}
              onSelect={pickDate}
              defaultMonth={isoToDate(value)}
            />
          </div>
        )}
      </div>
      <span className="hint">Formato gg/mm/aaaa</span>
    </label>
  );
}
