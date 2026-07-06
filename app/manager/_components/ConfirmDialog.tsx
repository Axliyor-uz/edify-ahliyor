"use client";

import { Loader2, AlertTriangle } from "lucide-react";
import ManagerSheet from "./ManagerSheet";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel, isLoading, onConfirm, onClose }: Props) {
  return (
    <ManagerSheet onClose={onClose} dismissible={!isLoading}>
      <div className="p-6 sm:p-7">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
          <AlertTriangle size={22} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{message}</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
          >
            Bekor qilish
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </ManagerSheet>
  );
}
