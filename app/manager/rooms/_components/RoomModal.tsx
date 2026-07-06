"use client";

import { useState } from "react";
import { DoorOpen, Loader2, Check, Building2 } from "lucide-react";
import toast from "react-hot-toast";
import { createRoom, updateRoom } from "@/services/roomService";
import { ROOM_COLORS, ROOM_FEATURES, ROOM_FEATURE_LABEL } from "@/types/rooms";
import type { Room, RoomColor, RoomFeature, RoomInput } from "@/types/rooms";
import { ROOM_THEME } from "@/lib/roomColors";
import { FEATURE_ICON } from "./featureIcons";

interface Props {
  centerId: string;
  room?: Room | null;      // edit mode when present
  nextOrderIndex: number;  // used for new rooms
  onClose: () => void;
  onSaved: () => void;
}

export default function RoomModal({ centerId, room, nextOrderIndex, onClose, onSaved }: Props) {
  const editing = !!room;
  const [name, setName] = useState(room?.name || "");
  const [capacity, setCapacity] = useState<number>(room?.capacity ?? 15);
  const [building, setBuilding] = useState(room?.building || "");
  const [color, setColor] = useState<RoomColor>(room?.color || "indigo");
  const [features, setFeatures] = useState<RoomFeature[]>(room?.features || []);
  const [isActive, setIsActive] = useState(room?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const toggleFeature = (f: RoomFeature) =>
    setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const input: RoomInput = { name, capacity: Math.max(1, capacity || 1), color, features, isActive, building };
    try {
      if (editing && room) await updateRoom(room.id, input);
      else await createRoom(centerId, input, nextOrderIndex);
      toast.success(editing ? "Xona yangilandi!" : "Xona qo'shildi!");
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Saqlashda xatolik yuz berdi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative bg-white w-full max-w-md rounded-[2rem] p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3.5 mb-6">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${ROOM_THEME[color].soft} ${ROOM_THEME[color].text}`}>
            <DoorOpen size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{editing ? "Xonani tahrirlash" : "Yangi xona"}</h2>
            <p className="text-[13px] text-slate-500 font-medium">Nomi, sig&apos;imi va jihozlarini kiriting</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name + capacity */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-[13px] font-bold text-slate-700 ml-1">Nomi <span className="text-rose-400">*</span></label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} disabled={saving}
                placeholder="Xona 4 / Lab 1"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all disabled:opacity-60" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-slate-700 ml-1">Sig&apos;im</label>
              <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} disabled={saving}
                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all disabled:opacity-60 tabular-nums" />
            </div>
          </div>

          {/* Building (optional) */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-bold text-slate-700 ml-1 flex items-center gap-1.5"><Building2 size={13} className="text-slate-400" /> Bino (ixtiyoriy)</label>
            <input type="text" value={building} onChange={(e) => setBuilding(e.target.value)} disabled={saving}
              placeholder="Asosiy bino / 2-qavat"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all disabled:opacity-60" />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-slate-700 ml-1">Rang</label>
            <div className="flex items-center gap-2.5">
              {ROOM_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
                  className={`w-8 h-8 rounded-full ${ROOM_THEME[c].bar} transition-transform active:scale-90 ${color === c ? `ring-2 ring-offset-2 ${ROOM_THEME[c].ring}` : "opacity-60 hover:opacity-100"}`}>
                  {color === c && <Check size={16} className="text-white mx-auto" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-slate-700 ml-1">Jihozlar</label>
            <div className="flex flex-wrap gap-2">
              {ROOM_FEATURES.map((f) => {
                const Icon = FEATURE_ICON[f];
                const on = features.includes(f);
                return (
                  <button key={f} type="button" onClick={() => toggleFeature(f)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold border transition-colors ${on ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
                    <Icon size={14} /> {ROOM_FEATURE_LABEL[f]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active toggle */}
          <button type="button" onClick={() => setIsActive((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[13.5px] font-semibold text-slate-700">Faol xona</span>
            <span className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? "bg-emerald-500" : "bg-slate-300"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isActive ? "translate-x-5" : "translate-x-0"}`} />
            </span>
          </button>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-60">Bekor qilish</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors disabled:opacity-60 shadow-sm shadow-amber-500/20">
              {saving ? <><Loader2 size={18} className="animate-spin" /> Saqlanmoqda...</> : editing ? "Saqlash" : "Qo'shish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
