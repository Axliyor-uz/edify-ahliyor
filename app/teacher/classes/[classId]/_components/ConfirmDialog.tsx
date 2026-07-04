'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Optional preview of the subject (e.g. student name + avatar) */
  subject?: React.ReactNode;
  /** Error text to show inside the dialog if the action fails */
  error?: string | null;
  variant?: 'danger' | 'default';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  subject,
  error,
  variant = 'danger',
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Focus the safe (cancel) button by default, and close on Esc.
  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, loading, onClose]);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const isDanger = variant === 'danger';

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6">
      {/* OVERLAY */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={() => !loading && onClose()}
      />

      {/* DIALOG */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative bg-white rounded-[2rem] w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-300 shadow-2xl border border-slate-100"
      >
        <button
          onClick={() => !loading && onClose()}
          className="absolute top-4 right-4 p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 disabled:opacity-50"
          disabled={loading}
          aria-label={cancelLabel}
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="px-6 pt-8 pb-6">
          {/* Icon */}
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
              isDanger ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'
            }`}
          >
            <AlertTriangle size={24} strokeWidth={2.25} />
          </div>

          <h2
            id="confirm-dialog-title"
            className="text-[18px] font-black text-slate-900 tracking-tight leading-tight"
          >
            {title}
          </h2>
          <p className="text-[14px] text-slate-500 font-medium mt-1.5 leading-relaxed">{message}</p>

          {/* Subject preview */}
          {subject && (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              {subject}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 text-[13px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-[14px] hover:bg-slate-50 transition-colors active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 h-11 rounded-xl font-bold text-[14px] text-white transition-colors active:scale-[0.98] outline-none focus-visible:ring-2 flex items-center justify-center gap-2 disabled:opacity-70 ${
              isDanger
                ? 'bg-rose-500 hover:bg-rose-600 focus-visible:ring-rose-300'
                : 'bg-indigo-500 hover:bg-indigo-600 focus-visible:ring-indigo-300'
            }`}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
