'use client';

// ─── "My Center" hub ─────────────────────────────────────────────────────────
// ONE page for everything a center student needs: center identity, their
// groups + weekly schedule, their attendance, and their money (balance /
// charges / payment history). Works even for a student with ZERO groups —
// membership comes from `center_students` (own-read allowed by rules), never
// from classes. Finance comes from GET /api/student/finance (Admin SDK; the
// finance collections stay manager-only in the rules — never query them here).

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useStudentLanguage } from '../layout';
import { fetchMyCenters, type MyCenter } from '@/services/studentCenterService';
import { getTodayKey, toDateKey } from '@/lib/dateUtils';
import {
  normalizeRecords, isCountedLesson, tallyStudent, type CenterSession,
} from '@/services/attendanceService';
import type { LessonStatus } from '@/types/attendance';
import {
  Building2, CalendarCheck, Wallet, Users, Clock,
  CheckCircle2, XCircle, ShieldQuestion, CircleDollarSign, ReceiptText,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import {
  Card, Chip, EmptyState, ListGroup, ListRow, LoadingState, Page, PageHeader,
  Stack, StatTile, cn, type Status,
} from '@/components/student-ui';

const DAYS_BACK = 92;

const CENTER_TRANSLATIONS: any = {
  uz: {
    title: "Mening Markazim",
    groups: "Guruhlarim", teacher: "O'qituvchi", schedule: "Jadval", noGroups: "Bu markazda hali guruhga qo'shilmagansiz.",
    attendance: "Davomat", attRate: "Davomat darajasi", present: "Kelgan", late: "Kechikkan", absent: "Kelmagan", excused: "Sababli", noAttendance: "Hali davomat belgilanmagan.",
    finance: "To'lovlar", balance: "Balans", debt: "Qarz", prepaid: "Avans", zero: "Balans nol", frozen: "Hisob muzlatilgan", discount: "Chegirma",
    charges: "Hisoblar (oyliklar)", payments: "To'lovlar tarixi", noFinance: "Hisob-kitob ma'lumotlari hali yo'q.",
    chargeStatus: { pending: "To'lanmagan", partial: "Qisman", paid: "To'langan", waived: "Kechirilgan", cancelled: "Bekor qilingan" },
    payType: { payment: "To'lov", refund: "Qaytarim" },
    methods: { cash: "Naqd", card: "Karta", click: "Click", payme: "Payme", transfer: "O'tkazma", other: "Boshqa" },
    cancelled: "Bekor qilingan", sum: "so'm",
    empty: { title: "Siz o'quv markaziga biriktirilmagansiz", desc: "Markaz menejeri sizni ro'yxatga qo'shganida bu sahifada markaz, davomat va to'lov ma'lumotlari ko'rinadi." },
  },
  en: {
    title: "My Center",
    groups: "My Groups", teacher: "Teacher", schedule: "Schedule", noGroups: "You are not in any group at this center yet.",
    attendance: "Attendance", attRate: "Attendance rate", present: "Present", late: "Late", absent: "Absent", excused: "Excused", noAttendance: "No attendance marked yet.",
    finance: "Payments", balance: "Balance", debt: "Owed", prepaid: "Prepaid", zero: "Settled", frozen: "Billing frozen", discount: "Discount",
    charges: "Charges (monthly)", payments: "Payment history", noFinance: "No billing records yet.",
    chargeStatus: { pending: "Unpaid", partial: "Partial", paid: "Paid", waived: "Waived", cancelled: "Cancelled" },
    payType: { payment: "Payment", refund: "Refund" },
    methods: { cash: "Cash", card: "Card", click: "Click", payme: "Payme", transfer: "Transfer", other: "Other" },
    cancelled: "Cancelled", sum: "UZS",
    empty: { title: "You are not linked to a learning center", desc: "Once a center manager adds you to their roster, this page shows your center, attendance and payment details." },
  },
  ru: {
    title: "Мой Центр",
    groups: "Мои группы", teacher: "Учитель", schedule: "Расписание", noGroups: "Вы пока не состоите в группах этого центра.",
    attendance: "Посещаемость", attRate: "Уровень посещаемости", present: "Присутствовал", late: "Опоздал", absent: "Отсутствовал", excused: "Уважительная", noAttendance: "Посещаемость пока не отмечена.",
    finance: "Платежи", balance: "Баланс", debt: "Долг", prepaid: "Аванс", zero: "Без долга", frozen: "Счёт заморожен", discount: "Скидка",
    charges: "Начисления (месяцы)", payments: "История платежей", noFinance: "Начислений пока нет.",
    chargeStatus: { pending: "Не оплачено", partial: "Частично", paid: "Оплачено", waived: "Прощено", cancelled: "Отменено" },
    payType: { payment: "Платёж", refund: "Возврат" },
    methods: { cash: "Наличные", card: "Карта", click: "Click", payme: "Payme", transfer: "Перевод", other: "Другое" },
    cancelled: "Отменён", sum: "сум",
    empty: { title: "Вы не привязаны к учебному центру", desc: "Когда менеджер центра добавит вас в список, здесь появятся данные центра, посещаемости и платежей." },
  },
};

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

const ATT_STYLE: Record<string, { status: Status; Icon: LucideIcon }> = {
  present: { status: 'success', Icon: CheckCircle2 },
  late: { status: 'warning', Icon: Clock },
  absent: { status: 'error', Icon: XCircle },
  excused: { status: 'neutral', Icon: ShieldQuestion },
};

const CHARGE_STATUS: Record<string, Status> = {
  pending: 'error',
  partial: 'warning',
  paid: 'success',
  waived: 'neutral',
  cancelled: 'neutral',
};

interface CenterGroup {
  id: string;
  title: string;
  teacherName: string;
  schedule: { dayOfWeek: number; startTime: string; endTime: string; roomName?: string }[];
}

interface CenterView extends MyCenter {
  groups: CenterGroup[];
  sessions: CenterSession[];
  finance: any | null;
}

/** Uppercase label that opens each section of a center block. */
function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-1.5 px-s-row-x pb-2 text-[12px] font-black uppercase tracking-[0.1em] text-on-surface-variant">
      <Icon size={13} strokeWidth={3} /> {children}
    </h2>
  );
}

export default function MyCenterPage() {
  const { user } = useAuth();
  const { lang } = useStudentLanguage();
  const t = CENTER_TRANSLATIONS[lang] || CENTER_TRANSLATIONS['en'];
  const locale = lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US';

  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<CenterView[]>([]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const uid = user!.uid;
        const [myCenters, myClassesSnap, financeRes] = await Promise.all([
          fetchMyCenters(uid),
          getDocs(query(collection(db, 'classes'), where('studentIds', 'array-contains', uid))),
          user!.getIdToken().then((token) =>
            fetch('/api/student/finance', { headers: { Authorization: `Bearer ${token}` } })
              .then((r) => (r.ok ? r.json() : { centers: [] }))
              .catch(() => ({ centers: [] })),
          ),
        ]);

        const myClasses = myClassesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const todayKey = getTodayKey();
        const startKey = toDateKey(new Date(Date.now() - DAYS_BACK * 86_400_000));

        const views: CenterView[] = await Promise.all(myCenters.map(async (center) => {
          const groups: CenterGroup[] = myClasses
            .filter((c) => c.centerId === center.centerId)
            .map((c) => ({
              id: c.id, title: c.title || '', teacherName: c.teacherName || '',
              schedule: Array.isArray(c.schedule) ? c.schedule : [],
            }));

          // Attendance: one classId+date range query per group (index exists).
          const sessionSnaps = await Promise.all(groups.map((g) =>
            getDocs(query(
              collection(db, 'center_attendance'),
              where('classId', '==', g.id),
              where('date', '>=', startKey),
              where('date', '<=', todayKey),
            )).catch(() => null),
          ));
          const sessions: CenterSession[] = sessionSnaps
            .filter(Boolean)
            .flatMap((snap) => snap!.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id, classId: data.classId, centerId: data.centerId, date: data.date,
                weekday: data.weekday ?? 0,
                lessonStatus: (data.lessonStatus as LessonStatus) || 'held',
                records: normalizeRecords(data.records),
              };
            }))
            .sort((a, b) => (a.date < b.date ? 1 : -1));

          const finance = (financeRes.centers || []).find((f: any) => f.centerId === center.centerId) || null;
          return { ...center, groups, sessions, finance };
        }));

        setCenters(views);
      } catch (e) {
        console.error('center hub load failed', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <Page>
        <LoadingState rows={4} />
      </Page>
    );
  }

  if (centers.length === 0) {
    return (
      <Page>
        <EmptyState
          icon={<Building2 size={28} strokeWidth={2.5} />}
          title={t.empty.title}
          description={t.empty.desc}
        />
      </Page>
    );
  }

  const todayKey = getTodayKey();

  return (
    <Page>
      <Stack>
        <PageHeader title={t.title} className="pb-0" />

        {centers.map((center) => {
          const uid = user!.uid;
          const tally = tallyStudent(center.sessions, uid, todayKey);
          const mySessions = center.sessions
            .filter((s) => isCountedLesson(s.lessonStatus, s.date, todayKey) && s.records[uid])
            .slice(0, 10);
          const fin = center.finance;
          const balanceLabel = fin ? (fin.balance < 0 ? t.debt : fin.balance > 0 ? t.prepaid : t.zero) : t.zero;
          const balanceStatus: Status = fin && fin.balance < 0
            ? 'error'
            : fin && fin.balance > 0
              ? 'success'
              : 'neutral';

          return (
            <section key={center.centerId} className="flex flex-col gap-s-section">
              {/* ── CENTER HEADER ── */}
              <Card variant="gradient" className="flex items-center gap-4">
                <Building2 size={30} strokeWidth={2.5} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.1em] opacity-80">{t.title}</p>
                  <h2 className="s-display truncate text-[22px] font-bold">{center.name || '—'}</h2>
                </div>
              </Card>

              {/* ── GROUPS + SCHEDULE ── */}
              <div>
                <SectionLabel icon={Users}>{t.groups}</SectionLabel>
                {center.groups.length === 0 ? (
                  <EmptyState icon="🏫" title={t.noGroups} className="py-8" />
                ) : (
                  <ListGroup>
                    {center.groups.map((g) => (
                      <Link key={g.id} href={`/classes/${g.id}`} className="block">
                        <ListRow
                          clickable
                          className="flex-wrap"
                          title={g.title}
                          subtitle={`${t.teacher}: ${g.teacherName || '—'}`}
                        >
                          {g.schedule.length > 0 && (
                            <div className="flex basis-full flex-wrap gap-1.5 pt-2">
                              {[...g.schedule]
                                .sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7))
                                .map((slot, i) => {
                                  const day = new Date(Date.UTC(2024, 0, 7 + slot.dayOfWeek))
                                    .toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
                                  return (
                                    <Chip key={i} className="capitalize">
                                      <span className="s-num">
                                        {day} {slot.startTime}–{slot.endTime}{slot.roomName ? ` · ${slot.roomName}` : ''}
                                      </span>
                                    </Chip>
                                  );
                                })}
                            </div>
                          )}
                        </ListRow>
                      </Link>
                    ))}
                  </ListGroup>
                )}
              </div>

              {/* ── ATTENDANCE ── */}
              <div>
                <SectionLabel icon={CalendarCheck}>{t.attendance}</SectionLabel>
                {mySessions.length === 0 ? (
                  <EmptyState icon="🗓️" title={t.noAttendance} className="py-8" />
                ) : (
                  <div className="flex flex-col gap-s-gap">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatTile
                        label={t.attRate}
                        value={tally.rate !== null ? `${tally.rate}%` : '—'}
                        tone="primary"
                        className="min-w-[140px]"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {(['present', 'late', 'absent', 'excused'] as const).map((k) => (
                          <Chip key={k} status={ATT_STYLE[k].status}>
                            {t[k]}: <span className="s-num">{tally[k]}</span>
                          </Chip>
                        ))}
                      </div>
                    </div>

                    <ListGroup>
                      {mySessions.map((s) => {
                        const status = s.records[uid]?.status;
                        const style = ATT_STYLE[status] || ATT_STYLE.excused;
                        const Icon = style.Icon;
                        const group = center.groups.find((g) => g.id === s.classId);
                        return (
                          <ListRow
                            key={s.id}
                            title={
                              <>
                                {new Date(`${s.date}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                                {group ? <span className="font-bold text-on-surface-variant"> · {group.title}</span> : null}
                              </>
                            }
                            trailing={
                              <Chip status={style.status} icon={<Icon size={12} strokeWidth={3} />}>
                                {t[status] || status}
                              </Chip>
                            }
                          />
                        );
                      })}
                    </ListGroup>
                  </div>
                )}
              </div>

              {/* ── FINANCE ── */}
              <div>
                <SectionLabel icon={Wallet}>{t.finance}</SectionLabel>
                {!fin ? (
                  <EmptyState icon="🧾" title={t.noFinance} className="py-8" />
                ) : (
                  <div className="flex flex-col gap-s-gap-lg">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatTile
                        label={t.balance}
                        value={`${fmt(Math.abs(fin.balance))} ${t.sum}`}
                        icon={<CircleDollarSign size={15} strokeWidth={2.8} />}
                        className="min-w-[200px]"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <Chip status={balanceStatus} size="md">{balanceLabel}</Chip>
                        {fin.financeStatus === 'frozen' && <Chip status="info">{t.frozen}</Chip>}
                        {fin.discountPercent > 0 && (
                          <Chip status="primary">{t.discount}: <span className="s-num">{fin.discountPercent}%</span></Chip>
                        )}
                      </div>
                    </div>

                    {fin.charges.length > 0 && (
                      <div>
                        <SectionLabel icon={ReceiptText}>{t.charges}</SectionLabel>
                        <ListGroup>
                          {fin.charges.map((ch: any) => (
                            <ListRow
                              key={ch.id}
                              title={`${ch.classTitle} · ${ch.periodKey}`}
                              subtitle={
                                <span className="s-num">
                                  {fmt(ch.paidAmount)} / {fmt(ch.amount)} {t.sum}
                                </span>
                              }
                              trailing={
                                <Chip
                                  status={CHARGE_STATUS[ch.status] || CHARGE_STATUS.pending}
                                  className={ch.status === 'cancelled' ? 'line-through' : undefined}
                                >
                                  {t.chargeStatus[ch.status] || ch.status}
                                </Chip>
                              }
                            />
                          ))}
                        </ListGroup>
                      </div>
                    )}

                    {fin.payments.length > 0 && (
                      <div>
                        <SectionLabel icon={Wallet}>{t.payments}</SectionLabel>
                        <ListGroup>
                          {fin.payments.map((p: any) => (
                            <ListRow
                              key={p.id}
                              className={p.status === 'cancelled' ? 'opacity-50' : undefined}
                              title={
                                <>
                                  {t.payType[p.type] || p.type} · {t.methods[p.method] || p.method}
                                  {p.status === 'cancelled' && (
                                    <span className="ml-2 text-[10px] font-black uppercase text-error">{t.cancelled}</span>
                                  )}
                                </>
                              }
                              subtitle={p.paidAt || ''}
                              trailing={
                                <span className={cn(
                                  's-num shrink-0 text-[13.5px] font-black',
                                  p.type === 'refund' ? 'text-error' : 'text-success',
                                )}>
                                  {p.type === 'refund' ? '−' : '+'}{fmt(p.amount)} {t.sum}
                                </span>
                              }
                            />
                          ))}
                        </ListGroup>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </Stack>
    </Page>
  );
}
