"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DoorOpen, Plus, Users, Pencil, Trash2, Loader2, Building2, AlertTriangle, X, CalendarDays } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterRooms } from "@/hooks/useCenterRooms";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import { deleteRoom, classesUsingRoom, roomUtilization } from "@/services/roomService";
import { ROOM_FEATURE_LABEL } from "@/types/rooms";
import type { Room } from "@/types/rooms";
import { roomTheme } from "@/lib/roomColors";
import RoomModal from "./_components/RoomModal";
import { FEATURE_ICON } from "./_components/featureIcons";

export default function RoomsPage() {
  const { user } = useAuth();
  const [centerId, setCenterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { rooms, isLoading, refetch } = useCenterRooms(centerId);
  const { classes } = useCenterClasses(centerId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);

  const utilization = useMemo(() => roomUtilization(classes), [classes]);
  const usageByRoom = useMemo(() => {
    const m = new Map<string, number>();
    rooms.forEach((r) => m.set(r.id, classesUsingRoom(classes, r.id).length));
    return m;
  }, [rooms, classes]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r: Room) => { setEditing(r); setModalOpen(true); };

  const usingGroups = deleteTarget ? classesUsingRoom(classes, deleteTarget.id) : [];

  const confirmDelete = async () => {
    if (!deleteTarget || usingGroups.length > 0) return;
    setDeleting(true);
    try {
      await deleteRoom(deleteTarget.id);
      toast.success("Xona o'chirildi.");
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      console.error(err);
      toast.error("O'chirishda xatolik.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <DoorOpen className="text-amber-500" size={24} /> Xonalar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Markazingizdagi xonalarni boshqaring</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/manager/timetable"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-[13px] transition-colors">
            <CalendarDays size={16} /> Jadval
          </Link>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-[13px] shadow-sm shadow-amber-500/25 transition-colors">
            <Plus size={17} strokeWidth={2.5} /> Yangi xona
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-slate-400" size={30} /></div>
      ) : rooms.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4"><DoorOpen size={28} /></div>
          <h3 className="text-[15px] font-semibold text-slate-800">Xonalar yo&apos;q</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-[280px]">Hali xona qo&apos;shilmagan. Guruhlarni xonalarga biriktirish uchun avval xona yarating.</p>
          <button onClick={openCreate} className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-[13px] transition-colors">
            <Plus size={16} /> Birinchi xonani qo&apos;shish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const th = roomTheme(room.color);
            const used = usageByRoom.get(room.id) || 0;
            const hours = utilization.get(room.id) || 0;
            return (
              <div key={room.id} className={`group relative bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden ${!room.isActive ? "opacity-60" : ""}`}>
                <div className={`h-1.5 ${th.bar}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${th.soft} ${th.text}`}><DoorOpen size={20} strokeWidth={2.5} /></div>
                      <div className="min-w-0">
                        <h3 className="text-[16px] font-bold text-slate-900 tracking-tight truncate">{room.name}</h3>
                        {room.building && <p className="text-[12px] text-slate-400 truncate flex items-center gap-1"><Building2 size={11} /> {room.building}</p>}
                      </div>
                    </div>
                    {!room.isActive && <span className="shrink-0 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Nofaol</span>}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-4 text-slate-600">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold"><Users size={15} className="text-slate-400" /> {room.capacity} <span className="text-[12px] text-slate-400 font-normal">o&apos;rin</span></span>
                    <span className="text-[13px] font-semibold">{used} <span className="text-[12px] text-slate-400 font-normal">guruh</span></span>
                    {hours > 0 && <span className="text-[13px] font-semibold tabular-nums">{hours}<span className="text-[12px] text-slate-400 font-normal"> soat/hafta</span></span>}
                  </div>

                  {/* Features */}
                  {room.features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {room.features.map((f) => {
                        const Icon = FEATURE_ICON[f];
                        return <span key={f} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[11px] font-medium text-slate-500"><Icon size={12} /> {ROOM_FEATURE_LABEL[f]}</span>;
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button onClick={() => openEdit(room)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[13px] font-semibold transition-colors"><Pencil size={14} /> Tahrirlash</button>
                    <button onClick={() => setDeleteTarget(room)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && centerId && (
        <RoomModal centerId={centerId} room={editing} nextOrderIndex={rooms.length}
          onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); refetch(); }} />
      )}

      {/* Delete confirm / block */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${usingGroups.length > 0 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"}`}>
                <AlertTriangle size={22} strokeWidth={2.5} />
              </div>
              <button onClick={() => setDeleteTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={17} /></button>
            </div>
            {usingGroups.length > 0 ? (
              <>
                <h3 className="text-[16px] font-bold text-slate-900 mt-4">Xonani o&apos;chirib bo&apos;lmaydi</h3>
                <p className="text-[13px] text-slate-500 mt-1.5">«{deleteTarget.name}» {usingGroups.length} ta guruhga biriktirilgan. Avval ularni boshqa xonaga o&apos;tkazing:</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {usingGroups.map((c) => <span key={c.id} className="text-[12px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">{c.title}</span>)}
                </div>
                <button onClick={() => setDeleteTarget(null)} className="w-full mt-5 py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition-colors">Tushunarli</button>
              </>
            ) : (
              <>
                <h3 className="text-[16px] font-bold text-slate-900 mt-4">Xonani o&apos;chirish</h3>
                <p className="text-[13px] text-slate-500 mt-1.5">«{deleteTarget.name}» butunlay o&apos;chiriladi. Bu amalni qaytarib bo&apos;lmaydi.</p>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-60">Bekor</button>
                  <button onClick={confirmDelete} disabled={deleting} className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60">
                    {deleting ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={16} />} O&apos;chirish
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
