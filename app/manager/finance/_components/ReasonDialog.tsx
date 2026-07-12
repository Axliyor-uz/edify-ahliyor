"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import ManagerSheet from "../../_components/ManagerSheet";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  placeholder?: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

/**
 * ConfirmDialog variant with a MANDATORY reason field — money records are never
 * deleted, only cancelled/waived with an audit reason (FINANCE.md rule #1).
 */
export default function ReasonDialog({ title, message, confirmLabel, placeholder, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ManagerSheet onClose={onClose} dismissible={!submitting}>
      <div className="p-6 sm:p-7">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
          <AlertTriangle size={22} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{message}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder || "Sababni yozing (majburiy)..."}
          rows={2}
          className="mt-4 w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none"
        />
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
          >
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={submitting || !reason.trim()}
            className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </ManagerSheet>
  );
}
