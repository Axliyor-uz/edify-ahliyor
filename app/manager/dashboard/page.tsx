"use client";

import { Bell, Users, CheckCircle, Wallet, AlertCircle, Plus, CreditCard, Clock, CalendarDays, ArrowRight } from "lucide-react";

export default function ManagerDashboard() {
  const currentDate = new Date().toLocaleDateString('uz-UZ', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  return (
    <div className="space-y-6">
      
      {/* 1. Top Bar Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-[28px] font-black text-slate-900 tracking-tight leading-tight">
            Xush kelibsiz, Rahbar
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <CalendarDays size={14} className="text-amber-500" />
            <p className="text-[14px] font-medium text-slate-500">{currentDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-amber-500 transition-colors shadow-sm">
            <Bell size={18} strokeWidth={2.5} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </header>

      {/* 2. Row 1: KPI Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-8">
        
        {/* KPI 1: Active Students */}
        <div className="bg-white p-5 rounded-[1.25rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-[100px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
              <Users size={20} strokeWidth={2.5} />
            </div>
            <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Faol o'quvchilar</h3>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">412</p>
          <p className="text-[12px] font-bold text-emerald-500 mt-1 flex items-center gap-1">
            <span className="text-emerald-500">+12%</span>
            <span className="text-slate-400 font-medium">shu oyda</span>
          </p>
        </div>

        {/* KPI 2: Today's Attendance */}
        <div className="bg-white p-5 rounded-[1.25rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-50 to-transparent rounded-bl-[100px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
              <CheckCircle size={20} strokeWidth={2.5} />
            </div>
            <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Bugungi davomat</h3>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">92.4%</p>
          <p className="text-[12px] font-medium text-slate-400 mt-1">QR orqali tasdiqlangan</p>
        </div>

        {/* KPI 3: Monthly Revenue */}
        <div className="bg-white p-5 rounded-[1.25rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-50 to-transparent rounded-bl-[100px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
              <Wallet size={20} strokeWidth={2.5} />
            </div>
            <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Moliya - Shu oy</h3>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">84.5<span className="text-xl font-bold text-slate-500">M</span></p>
          <p className="text-[12px] font-medium text-slate-400 mt-1">Maqsad: 100M UZS</p>
        </div>

        {/* KPI 4: Debtors Count */}
        <div className="bg-white p-5 rounded-[1.25rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-50 to-transparent rounded-bl-[100px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600 shadow-sm">
              <AlertCircle size={20} strokeWidth={2.5} />
            </div>
            <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">Qarzdorlar</h3>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">18 <span className="text-xl font-bold text-slate-500">ta</span></p>
          <p className="text-[12px] font-medium text-slate-400 mt-1 text-red-500 font-bold">Umumiy balans manfiy</p>
        </div>
      </div>

      {/* 3. Row 2: Splits & Operational Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Section: Today's Active Schedule Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-black text-slate-900 tracking-tight">Bugungi Darslar Jadvali</h2>
            <button className="text-[13px] font-bold text-amber-600 hover:text-amber-700 hover:underline underline-offset-4 transition-colors">Barchasini ko'rish</button>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm overflow-hidden overflow-x-auto custom-scrollbar">
            <div className="min-w-[500px]">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-3 px-6 py-4 bg-slate-50/50 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <div className="col-span-3">Vaqt</div>
                <div className="col-span-4">Guruh & Ustoz</div>
                <div className="col-span-2">Xona</div>
                <div className="col-span-3 text-right">Holat</div>
              </div>

              {/* List Items */}
              <div className="divide-y divide-slate-100">
                
                {/* Item 1 */}
                <div className="grid grid-cols-12 gap-3 px-6 py-4 items-center hover:bg-slate-50 transition-colors group">
                  <div className="col-span-3 flex items-center gap-2">
                    <Clock size={14} className="text-amber-500 shrink-0" />
                    <span className="text-[14px] font-bold text-slate-700">14:00 - 15:30</span>
                  </div>
                  <div className="col-span-4">
                    <p className="text-[14px] font-bold text-slate-900 group-hover:text-amber-600 transition-colors truncate">SAT Math Foundation</p>
                    <p className="text-[12px] font-medium text-slate-500 truncate">Mr. Akhmad</p>
                  </div>
                  <div className="col-span-2">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[12px] font-bold rounded-lg border border-slate-200">Room 4</span>
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[12px] font-bold rounded-full border border-emerald-100 flex items-center gap-1.5 w-max">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Active
                    </span>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="grid grid-cols-12 gap-3 px-6 py-4 items-center hover:bg-slate-50 transition-colors group">
                  <div className="col-span-3 flex items-center gap-2">
                    <Clock size={14} className="text-slate-400 shrink-0" />
                    <span className="text-[14px] font-bold text-slate-700">16:00 - 17:30</span>
                  </div>
                  <div className="col-span-4">
                    <p className="text-[14px] font-bold text-slate-900 group-hover:text-amber-600 transition-colors truncate">IELTS Reading 7.0+</p>
                    <p className="text-[12px] font-medium text-slate-500 truncate">Ms. Malika</p>
                  </div>
                  <div className="col-span-2">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[12px] font-bold rounded-lg border border-slate-200">Room 2</span>
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[12px] font-bold rounded-full border border-amber-100 w-max">
                      Pending
                    </span>
                  </div>
                </div>
                
                {/* Item 3 */}
                <div className="grid grid-cols-12 gap-3 px-6 py-4 items-center hover:bg-slate-50 transition-colors group">
                  <div className="col-span-3 flex items-center gap-2">
                    <Clock size={14} className="text-slate-400 shrink-0" />
                    <span className="text-[14px] font-bold text-slate-700">10:00 - 11:30</span>
                  </div>
                  <div className="col-span-4">
                    <p className="text-[14px] font-bold text-slate-900 group-hover:text-amber-600 transition-colors truncate">Beginner English</p>
                    <p className="text-[12px] font-medium text-slate-500 truncate">Mr. Zafar</p>
                  </div>
                  <div className="col-span-2">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[12px] font-bold rounded-lg border border-slate-200">Room 1</span>
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[12px] font-bold rounded-full border border-slate-200 w-max">
                      Finished
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Quick Action Terminal */}
        <div className="space-y-6">
          
          <div className="bg-white p-5 border border-slate-200 rounded-[1.5rem] shadow-sm">
            <h2 className="text-[15px] font-black text-slate-900 tracking-tight mb-4">Tezkor amallar</h2>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3.5 bg-amber-50 hover:bg-amber-100 border border-amber-100 rounded-xl transition-all group active:scale-[0.98]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-100 group-hover:bg-amber-200 rounded-lg flex items-center justify-center text-amber-700 transition-colors shrink-0">
                    <Plus size={18} strokeWidth={2.5} />
                  </div>
                  <span className="font-bold text-[14px] text-amber-900">Yangi o'quvchi qo'shish</span>
                </div>
                <ArrowRight size={16} className="text-amber-500 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>
              
              <button className="w-full flex items-center justify-between p-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-xl transition-all group active:scale-[0.98]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 group-hover:bg-emerald-200 rounded-lg flex items-center justify-center text-emerald-700 transition-colors shrink-0">
                    <CreditCard size={18} strokeWidth={2.5} />
                  </div>
                  <span className="font-bold text-[14px] text-emerald-900">To'lov qabul qilish</span>
                </div>
                <ArrowRight size={16} className="text-emerald-500 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white p-5 border border-slate-200 rounded-[1.5rem] shadow-sm">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-[15px] font-black text-slate-900 tracking-tight">So'nggi to'lovlar</h2>
               <button className="w-7 h-7 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors shrink-0">
                 <ArrowRight size={14} className="text-slate-400" />
               </button>
             </div>
             
             <div className="space-y-4">
               <div className="flex items-start gap-3">
                 <div className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0"></div>
                 <div>
                   <p className="text-[13px] font-bold text-slate-900 leading-tight">Alimov A. <span className="font-medium text-slate-500">to'lov qildi</span> 450,000 UZS</p>
                   <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Payme orqali • 15 daqiqa oldin</p>
                 </div>
               </div>
               <div className="flex items-start gap-3">
                 <div className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                 <div>
                   <p className="text-[13px] font-bold text-slate-900 leading-tight">Botirova M. <span className="font-medium text-slate-500">to'lov qildi</span> 380,000 UZS</p>
                   <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Naqd pul • 1 soat oldin</p>
                 </div>
               </div>
               <div className="flex items-start gap-3">
                 <div className="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                 <div>
                   <p className="text-[13px] font-bold text-slate-900 leading-tight">Umarov S. <span className="font-medium text-slate-500">to'lov qildi</span> 450,000 UZS</p>
                   <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Click orqali • 3 soat oldin</p>
                 </div>
               </div>
             </div>
          </div>

        </div>

      </div>
    </div>
  );
}
