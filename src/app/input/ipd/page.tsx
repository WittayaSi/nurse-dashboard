'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import LoadingOverlay from '@/components/LoadingOverlay';
import { calcIPDHppd, calcIPDProductivity } from '@/lib/ipd-calc';

interface Ward {
    id: number;
    code: string;
    name: string;
    deptType: string;
    bedCount?: number;
}

interface ShiftData {
    hnCount: number;
    rnCount: number;
    pnCount: number;
    naCount: number;
}

interface SummaryData {
    totalStaffDay: number;
    patientDay: number;
    hppd: number;
    dischargeCount: number;
    newAdmission: number;
    productivity: number;
    cmi: number;
    capStatus: string;
    totalBeds?: number;
}

interface ToastMessage {
    id: number;
    type: 'success' | 'error';
    text: string;
}

const emptyShift = (): ShiftData => ({ hnCount: 0, rnCount: 0, pnCount: 0, naCount: 0 });
const emptySummary = (): SummaryData => ({
    totalStaffDay: 0, patientDay: 0, hppd: 0,
    dischargeCount: 0, newAdmission: 0,
    productivity: 0, cmi: 0, capStatus: 'suitable',
    totalBeds: 0
});

// --- Toast Component ---
function Toast({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2" aria-live="assertive" role="alert">
            {toasts.map(t => (
                <div key={t.id}
                    className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold animate-slide-in
                        ${t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
                >
                    <i className={`fa-solid ${t.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                    <span>{t.text}</span>
                    <button onClick={() => onDismiss(t.id)} className="ml-2 opacity-70 hover:opacity-100"
                        aria-label="ปิดการแจ้งเตือน">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            ))}
            <style jsx>{`
                @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                .animate-slide-in { animation: slide-in 0.3s ease-out; }
            `}</style>
        </div>
    );
}

// --- Loading Skeleton ---
function LoadingSkeleton() {
    return (
        <div className="animate-pulse space-y-6" role="status" aria-label="กำลังโหลดข้อมูล">
            <div className="card-kpi p-0 overflow-hidden">
                <div className="gradient-header px-5 py-3 text-white"><div className="h-5 bg-white/20 rounded w-40"></div></div>
                <div className="p-4 space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-200 rounded-lg"></div>)}
                </div>
            </div>
            <div className="card-kpi p-0 overflow-hidden">
                <div className="bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-3"><div className="h-5 bg-white/20 rounded w-32"></div></div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-14 bg-gray-200 rounded-xl"></div>)}
                </div>
            </div>
            <span className="sr-only">กำลังโหลดข้อมูล...</span>
        </div>
    );
}

export default function IPDInputPage() {
    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <IPDInputContent />
        </Suspense>
    );
}

function IPDInputContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const initWardCode = searchParams.get('ward_code') || '';

    const [wards, setWards] = useState<Ward[]>([]);
    const [selectedWard, setSelectedWard] = useState<number>(0);
    const [urlWardCode, setUrlWardCode] = useState<string>(initWardCode);
    const [date, setDate] = useState<string>(initDate);
    const [shifts, setShifts] = useState<{ morning: ShiftData; afternoon: ShiftData; night: ShiftData }>({
        morning: emptyShift(), afternoon: emptyShift(), night: emptyShift()
    });
    const [summary, setSummary] = useState<SummaryData>(emptySummary());
    const [saving, setSaving] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; wardName: string; dateStr: string; isOverBeds?: boolean; maxBeds?: number } | null>(null);
    const [hasExistingData, setHasExistingData] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetchingHis, setFetchingHis] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const toastIdRef = useRef(0);

    // Snapshot of saved data for dirty tracking
    const savedDataRef = useRef<{ shifts: typeof shifts; summary: SummaryData } | null>(null);

    const readonly = hasExistingData && !isEditing;

    // --- Toast helpers ---
    const showToast = useCallback((type: 'success' | 'error', text: string) => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, type, text }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const dismissToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // --- Fetch HIS Data ---
    const handleFetchHis = async () => {
        if (!selectedWard || !date) {
            showToast('error', 'กรุณาเลือกหอผู้ป่วยและวันที่ก่อนดึงข้อมูล HIS');
            return;
        }

        setFetchingHis(true);
        try {
            const res = await fetch('/api/ipd/his', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wardId: selectedWard, date })
            });

            if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูล HIS ได้');

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (!data.mappedHisKeys || data.mappedHisKeys.length === 0) {
                showToast('error', 'ระบบยังไม่ได้ตั้งค่ารหัสเชื่อมต่อ HIS สำหรับหน่วยงานนี้');
                return;
            }

            setSummary(prev => ({
                ...prev,
                patientDay: data.patientDay,
                newAdmission: data.newAdmission,
                dischargeCount: data.dischargeCount,
                totalBeds: data.totalBeds || 0
            }));
            showToast('success', `ดึงข้อมูลจาก HIS สำเร็จแล้ว (รวม ${data.totalBeds || 0} เตียง)`);
        } catch (err: any) {
            showToast('error', err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ HIS');
        } finally {
            setFetchingHis(false);
        }
    };

    // --- Unsaved changes warning (beforeunload) ---
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isDirty) { e.preventDefault(); }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    // --- Dirty tracking ---
    useEffect(() => {
        if (!savedDataRef.current || readonly) { setIsDirty(false); return; }
        const saved = savedDataRef.current;
        const shiftsChanged = JSON.stringify(shifts) !== JSON.stringify(saved.shifts);
        const summaryChanged = JSON.stringify(summary) !== JSON.stringify(saved.summary);
        setIsDirty(shiftsChanged || summaryChanged);
    }, [shifts, summary, readonly]);

    // Sync state to URL
    const pathname = usePathname();
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        let changed = false;

        const currentWard = wards.find(w => w.id === selectedWard);
        if (selectedWard && currentWard) {
            if (params.get('ward_code') !== currentWard.code) {
                params.set('ward_code', currentWard.code);
                changed = true;
            }
        }
        if (params.get('date') !== date) {
            params.set('date', date);
            changed = true;
        }

        if (changed) {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [selectedWard, wards, date, pathname, router, searchParams]);

    useEffect(() => {
        fetch('/api/wards?deptType=IPD')
            .then(res => res.json())
            .then(data => {
                setWards(data);
                if (data.length > 0) {
                    if (urlWardCode) {
                        const matchedWard = data.find((w: Ward) => w.code === urlWardCode);
                        if (matchedWard) {
                            setSelectedWard(matchedWard.id);
                        } else {
                            setSelectedWard(data[0].id);
                        }
                    } else {
                        setSelectedWard(data[0].id);
                    }
                }
            })
            .catch(err => console.error('Error loading wards:', err));
    }, [urlWardCode]);

    useEffect(() => {
        if (!selectedWard || !date) return;
        loadExistingData();
    }, [selectedWard, date]);

    const loadExistingData = async () => {
        setLoading(true);
        try {
            const shiftsRes = await fetch(`/api/ipd/shifts?date=${date}&wardId=${selectedWard}`);
            const shiftsData = await shiftsRes.json();

            const newShifts = { morning: emptyShift(), afternoon: emptyShift(), night: emptyShift() };
            shiftsData.forEach((s: any) => {
                const key = s.shift as keyof typeof newShifts;
                if (newShifts[key]) {
                    newShifts[key] = {
                        hnCount: s.hnCount ?? 0,
                        rnCount: s.rnCount ?? 0,
                        pnCount: s.pnCount ?? 0,
                        naCount: s.naCount ?? 0,
                    };
                }
            });
            setShifts(newShifts);
            setHasExistingData(shiftsData.length > 0);
            setIsEditing(false);

            const summaryRes = await fetch(`/api/ipd/summary?date=${date}&wardId=${selectedWard}`);
            const summaryData = await summaryRes.json();
            let loadedSummary: SummaryData;
            if (summaryData.length > 0) {
                const s = summaryData[0];
                loadedSummary = {
                    totalStaffDay: s.totalStaffDay ?? 0,
                    patientDay: s.patientDay ?? 0,
                    hppd: parseFloat(s.hppd) || 0,
                    dischargeCount: s.dischargeCount ?? 0,
                    newAdmission: s.newAdmission ?? 0,
                    productivity: parseFloat(s.productivity) || 0,
                    cmi: parseFloat(s.cmi) || 0,
                    capStatus: s.capStatus ?? 'suitable',
                };
                if (s.updatedAt) {
                    setLastSavedAt(new Date(s.updatedAt).toLocaleString('th-TH', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    }));
                } else {
                    setLastSavedAt(null);
                }
            } else {
                loadedSummary = emptySummary();
                setLastSavedAt(null);
            }
            setSummary(loadedSummary);
            savedDataRef.current = { shifts: newShifts, summary: loadedSummary };
            setIsDirty(false);
        } catch (err) {
            console.error('Error loading existing data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleShiftChange = (shift: 'morning' | 'afternoon' | 'night', field: keyof ShiftData, value: string) => {
        if (readonly) return;
        setShifts(prev => ({
            ...prev,
            [shift]: { ...prev[shift], [field]: parseInt(value) || 0 }
        }));
    };

    const handleSummaryChange = (field: keyof SummaryData, value: string) => {
        if (readonly) return;
        setSummary(prev => ({
            ...prev,
            [field]: field === 'capStatus' ? value : (parseFloat(value) || 0)
        }));
    };

    // Auto calculate total staff
    const totalStaff = (s: ShiftData) => s.hnCount + s.rnCount + s.pnCount + s.naCount;
    const totalAllShifts = totalStaff(shifts.morning) + totalStaff(shifts.afternoon) + totalStaff(shifts.night);

    // Detect ICU ward
    const currentWardObj = wards.find(w => w.id === selectedWard);
    const isIcuWard = currentWardObj ? /icu/i.test(currentWardObj.name) : false;
    const isSpecialWard = currentWardObj ? /พิเศษ/i.test(currentWardObj.name) : false;

    // Auto calculate HPPD & Productivity (shared formula)
    const calcHppd = calcIPDHppd(totalAllShifts, summary.patientDay);
    const calcProductivity = calcIPDProductivity(totalAllShifts, summary.patientDay, calcHppd);

    const handleSave = async () => {
        // Validation
        if (!selectedWard) { showToast('error', 'กรุณาเลือกหอผู้ป่วย'); return; }
        if (!date) { showToast('error', 'กรุณาเลือกวันที่'); return; }

        // ไม่บังคับต้องกรอกครบทุกเวร กรอกเวรไหนก็บันทึกได้เลย
        const shiftNames = { morning: 'เช้า', afternoon: 'บ่าย', night: 'ดึก' };
        let totalStaff = 0;
        for (const [key] of Object.entries(shiftNames)) {
            const s = shifts[key as keyof typeof shifts];
            totalStaff += (s.hnCount || 0) + (s.rnCount || 0) + (s.pnCount || 0) + (s.naCount || 0);
        }

        if (totalStaff === 0 && (!summary.patientDay || summary.patientDay <= 0)) {
            showToast('error', 'กรุณากรอกข้อมูลอย่างน้อย 1 รายการ');
            return;
        }

        const wardName = wards.find(w => w.id === selectedWard)?.name || '';
        const maxBeds = wards.find(w => w.id === selectedWard)?.bedCount || summary.totalBeds || 0;
        const isOverBeds = maxBeds > 0 && summary.patientDay > maxBeds;

        if (isOverBeds || isEditing) {
            setConfirmDialog({
                open: true,
                wardName,
                dateStr: date.split('-').reverse().join('/'),
                isOverBeds,
                maxBeds
            });
            return;
        }

        doSave();
    };

    const doSave = async () => {
        setConfirmDialog(null);

        setSaving(true);
        try {
            const shiftPayload = ['morning', 'afternoon', 'night'].map(shift => ({
                wardId: selectedWard,
                recordDate: date,
                shift,
                ...shifts[shift as keyof typeof shifts],
            }));

            const summaryPayload = {
                wardId: selectedWard,
                recordDate: date,
                ...summary,
                totalStaffDay: totalAllShifts,
                hppd: calcHppd,
                productivity: calcProductivity,
            };

            const response = await fetch('/api/ipd/save-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shifts: shiftPayload, summary: summaryPayload }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to save data');
            }

            showToast('success', 'บันทึกข้อมูลสำเร็จ!');
            setIsDirty(false);
            await loadExistingData();
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setSaving(false);
        }
    };

    const copyFromYesterday = async () => {
        if (!selectedWard || !date) return;

        const yesterday = new Date(date);
        yesterday.setDate(yesterday.getDate() - 1);
        const yestStr = yesterday.toISOString().split('T')[0];

        setLoading(true);
        try {
            const res = await fetch(`/api/ipd/shifts?date=${yestStr}&wardId=${selectedWard}`);
            if (!res.ok) throw new Error('Failed to fetch yesterday data');
            const data = await res.json();

            if (data.length === 0) {
                showToast('error', 'ไม่มีข้อมูลของเมื่อวานให้คัดลอก');
                return;
            }

            const newShifts = { ...shifts };
            data.forEach((s: any) => {
                const key = s.shift as keyof typeof newShifts;
                if (newShifts[key]) {
                    newShifts[key] = {
                        hnCount: s.hnCount ?? 0,
                        rnCount: s.rnCount ?? 0,
                        pnCount: s.pnCount ?? 0,
                        naCount: s.naCount ?? 0,
                    };
                }
            });
            setShifts(newShifts);
            setIsDirty(true);
            showToast('success', 'คัดลอกข้อมูลกำลังคนจากเมื่อวานเรียบร้อยแล้ว');
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const shiftLabels = [
        { key: 'morning' as const, label: '☀️ เช้า', bg: 'bg-amber-50', border: 'border-amber-200' },
        { key: 'afternoon' as const, label: '🌤️ บ่าย', bg: 'bg-blue-50', border: 'border-blue-200' },
        { key: 'night' as const, label: '🌙 ดึก', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    ];

    const fieldLabels: Record<string, string> = { hnCount: 'HN', rnCount: 'RN', pnCount: isSpecialWard ? 'PN' : 'PN', naCount: 'NA' };
    const shiftThaiLabels: Record<string, string> = { morning: 'เช้า', afternoon: 'บ่าย', night: 'ดึก' };

    // Filter staff fields: hide TN for normal wards, show as PN for ward พิเศษ
    const staffFields = isSpecialWard
        ? (['hnCount', 'rnCount', 'pnCount', 'naCount'] as const)
        : (['hnCount', 'rnCount', 'naCount'] as const);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
            {/* Toast Notifications */}
            <Toast toasts={toasts} onDismiss={dismissToast} />

            {/* Confirm Dialog */}
            {confirmDialog?.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDialog(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className={`px-6 py-4 flex items-center gap-3 text-white ${confirmDialog.isOverBeds ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}>
                            <div className="bg-white/20 p-2 rounded-lg">
                                <i className={`fa-solid ${confirmDialog.isOverBeds ? 'fa-user-injured' : 'fa-triangle-exclamation'} text-xl`}></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">
                                    {confirmDialog.isOverBeds ? 'แจ้งเตือน: จำนวนผู้ป่วยเกินเตียง' : 'ยืนยันการอัพเดทข้อมูล'}
                                </h3>
                                <p className="text-white/80 text-xs">
                                    {confirmDialog.isOverBeds ? `เตียงทั้งหมดมี ${confirmDialog.maxBeds} เตียง แต่กรอกคนไข้ข้ามคืน ${summary.patientDay} คน ยืนยันใช่หรือไม่?` : 'ข้อมูลเดิมจะถูกเขียนทับ'}
                                </p>
                            </div>
                        </div>
                        <div className="px-6 py-5 space-y-3">
                            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                                <i className="fa-solid fa-hospital text-teal-500"></i>
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">หอผู้ป่วย</p>
                                    <p className="text-sm font-bold text-gray-800">{confirmDialog.wardName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                                <i className="fa-solid fa-calendar text-indigo-500"></i>
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">วันที่</p>
                                    <p className="text-sm font-bold text-gray-800">{confirmDialog.dateStr}</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 pb-5 flex gap-3">
                            <button onClick={() => setConfirmDialog(null)}
                                className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                                ยกเลิก
                            </button>
                            <button onClick={doSave}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:opacity-95 transition-all active:scale-95">
                                <i className="fa-solid fa-check mr-1"></i> ยืนยัน
                            </button>
                        </div>
                    </div>
                    <style jsx>{`
                        @keyframes scale-in { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                        .animate-scale-in { animation: scale-in 0.2s ease-out; }
                    `}</style>
                </div>
            )}

            {/* Header */}
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="text-gray-400 hover:text-indigo-600 transition-colors"
                        aria-label="ย้อนกลับ">
                        <i className="fa-solid fa-arrow-left text-lg"></i>
                    </button>
                    <div className="gradient-header p-3 rounded-xl shadow-lg text-white" aria-hidden="true">
                        <i className="fa-solid fa-bed text-xl"></i>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">บันทึกข้อมูล IPD</h1>
                        <p className="text-xs text-gray-500">กรอกข้อมูลกำลังคนผู้ป่วยใน</p>
                    </div>
                </div>
                <Link href="/input/opd" className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                    aria-label="ไปหน้า OPD">
                    <span>OPD</span> <i className="fa-solid fa-arrow-right"></i>
                </Link>
            </header>

            {/* Filters */}
            <div className="glass-panel p-4 mb-6 flex flex-wrap gap-4 items-end" role="search" aria-label="ตัวกรองข้อมูล">
                <div className="flex-1 min-w-[200px]">
                    <label htmlFor="ipd-ward-select" className="text-xs font-bold text-gray-600 mb-1 block">🏥 หอผู้ป่วย</label>
                    <select
                        id="ipd-ward-select"
                        value={selectedWard}
                        onChange={(e) => setSelectedWard(parseInt(e.target.value))}
                        className="w-full px-3 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-sm font-semibold"
                        aria-label="เลือกหอผู้ป่วย"
                    >
                        {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div className="min-w-[180px]">
                    <label htmlFor="ipd-date-input" className="text-xs font-bold text-gray-600 mb-1 block">📅 วันที่</label>
                    <div className="relative group flex items-center bg-white border-2 border-gray-200 rounded-xl hover:border-indigo-500 transition-colors focus-within:border-indigo-500 h-[46px] cursor-pointer">
                        {/* The actual native input is the single source of truth for clicks */}
                        <input
                            id="ipd-date-input"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            onKeyDown={(e) => e.preventDefault()}
                            className="w-full h-full bg-transparent px-3 py-2.5 outline-none cursor-pointer date-input-full-picker text-transparent"
                            aria-label="เลือกวันที่"
                        />
                        {/* The visual overlay sits on top but is completely transparent to clicks */}
                        <div className="absolute inset-0 flex justify-between items-center px-3 text-sm font-semibold text-gray-800 pointer-events-none">
                            <span>{date ? date.split('-').reverse().join('/') : ''}</span>
                            <i className="fa-regular fa-calendar-days text-gray-400 group-hover:text-indigo-500 transition-colors"></i>
                        </div>
                    </div>
                </div>

                <div className="flex items-end">
                    <button
                        onClick={copyFromYesterday}
                        disabled={loading || readonly || !selectedWard || !date}
                        className="h-[46px] px-4 bg-white border-2 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                        aria-label="คัดลอกเวรจากเมื่อวาน"
                        title="คัดลอกข้อมูลเวรจากเมื่อวาน"
                        type="button"
                    >
                        <i className="fa-solid fa-copy group-hover:scale-110 transition-transform"></i>
                        <span className="hidden sm:inline">คัดลอกเวรจากเมื่อวาน</span>
                    </button>
                </div>
            </div>

            <LoadingOverlay isLoading={loading} message="กำลังดึงข้อมูล IPD..." />

            {/* Content always visible, just overlaid when loading */}
            <div className={`transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                {/* Shift Data — all shifts in one row */}
                <section className="card-kpi p-0 mb-6 overflow-hidden" aria-label="ข้อมูลกำลังคนรายเวร">
                    <div className="gradient-header px-5 py-3 text-white flex items-center gap-2">
                        <i className="fa-solid fa-clock" aria-hidden="true"></i>
                        <span className="font-bold">ข้อมูลกำลังคนรายเวร</span>
                    </div>

                    {/* Shift column headers */}
                    <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `120px repeat(3, 1fr) 80px` }}>
                        <div className="bg-gray-50 px-3 py-2"></div>
                        {shiftLabels.map(({ key, label, bg }) => (
                            <div key={key} className={`${bg} px-3 py-2 text-center border-l border-gray-200`}>
                                <span className="font-bold text-gray-700 text-sm">{label}</span>
                            </div>
                        ))}
                        <div className="bg-gray-100 px-2 py-2 text-center border-l border-gray-200">
                            <span className="font-bold text-gray-600 text-xs">รวม</span>
                        </div>
                    </div>

                    <div className="p-4 space-y-2">
                        {/* Staff rows */}
                        {staffFields.map(field => (
                            <div key={field} className="grid items-center gap-2" style={{ gridTemplateColumns: `120px repeat(3, 1fr) 80px` }}>
                                <div className={`text-xs font-bold px-1 ${field === 'rnCount' ? 'text-pink-600' : field === 'naCount' ? 'text-amber-600' : 'text-gray-600'}`}>
                                    {fieldLabels[field]}
                                </div>
                                {shiftLabels.map(({ key }) => (
                                    <input key={key}
                                        type="number" min="0" inputMode="numeric"
                                        value={shifts[key][field] || ''}
                                        onChange={(e) => handleShiftChange(key, field, e.target.value)}
                                        disabled={readonly}
                                        aria-label={`${fieldLabels[field]} เวร${shiftThaiLabels[key]}`}
                                        className={`w-full px-1 py-1.5 border rounded-lg text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-200 text-gray-700'}`}
                                    />
                                ))}
                                <div className="text-center text-sm font-bold text-indigo-700 bg-indigo-50 rounded-lg py-1.5">
                                    {shifts.morning[field] + shifts.afternoon[field] + shifts.night[field]}
                                </div>
                            </div>
                        ))}

                        {/* Total row */}
                        <hr className="border-gray-100" />
                        <div className="grid items-center gap-2" style={{ gridTemplateColumns: `120px repeat(3, 1fr) 80px` }}>
                            <div className="text-xs font-bold text-gray-700 px-1">📊 รวม</div>
                            {shiftLabels.map(({ key }) => (
                                <div key={key} className="text-center text-sm font-bold text-gray-700 bg-gray-50 rounded-lg py-1.5">
                                    {totalStaff(shifts[key])}
                                </div>
                            ))}
                            <div className="text-center text-base font-bold text-indigo-700 bg-indigo-100 rounded-lg py-1.5"
                                aria-live="polite" aria-label="รวมบุคลากรทั้งวัน">
                                {totalAllShifts}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Summary Data */}
                <section className="card-kpi p-0 mb-6 overflow-hidden" aria-label="สรุปรายวัน">
                    <div className="bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-3 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <i className="fa-solid fa-clipboard-list" aria-hidden="true"></i>
                            <span className="font-bold">สรุปรายวัน</span>
                        </div>
                        <button
                            onClick={handleFetchHis}
                            disabled={fetchingHis || readonly || !selectedWard || !date}
                            className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="ดึงข้อมูลจาก HIS"
                            type="button"
                        >
                            {fetchingHis ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-down"></i>}
                            ดึงข้อมูล HIS
                        </button>
                    </div>
                    <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label htmlFor="ipd-patient-day" className="text-xs font-bold text-gray-500 mb-1 block">Pt/Day (ผู้ป่วย)</label>
                            <input id="ipd-patient-day" type="number" min="0" inputMode="numeric"
                                value={summary.patientDay || ''}
                                onChange={(e) => handleSummaryChange('patientDay', e.target.value)}
                                disabled={readonly}
                                aria-label="จำนวนผู้ป่วยต่อวัน"
                                className={`w-full px-3 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300 text-sm font-bold transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-200 focus:border-teal-500 text-gray-700'}`}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-teal-600 mb-1 block">📐 HPPD <span className="text-gray-400">(คำนวณอัตโนมัติ)</span></label>
                            <div className="w-full px-3 py-2.5 bg-teal-50 border-2 border-teal-200 rounded-xl text-sm font-bold text-teal-700"
                                role="status" aria-live="polite" aria-label={`HPPD: ${calcHppd || 'ยังไม่มีข้อมูล'}`}>
                                {calcHppd || '-'}
                                <span className="text-[10px] text-gray-400 ml-1">= (Staff×7) / Pt</span>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="ipd-discharge" className="text-xs font-bold text-gray-500 mb-1 block">ยอด D/C</label>
                            <input id="ipd-discharge" type="number" min="0" inputMode="numeric"
                                value={summary.dischargeCount || ''}
                                onChange={(e) => handleSummaryChange('dischargeCount', e.target.value)}
                                disabled={readonly}
                                aria-label="จำนวน Discharge"
                                className={`w-full px-3 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300 text-sm font-bold transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-200 focus:border-teal-500 text-gray-700'}`}
                            />
                        </div>
                        <div>
                            <label htmlFor="ipd-new-admission" className="text-xs font-bold text-gray-500 mb-1 block">รับใหม่</label>
                            <input id="ipd-new-admission" type="number" min="0" inputMode="numeric"
                                value={summary.newAdmission || ''}
                                onChange={(e) => handleSummaryChange('newAdmission', e.target.value)}
                                disabled={readonly}
                                aria-label="จำนวนรับใหม่"
                                className={`w-full px-3 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300 text-sm font-bold transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-200 focus:border-teal-500 text-gray-700'}`}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-purple-600 mb-1 block">📊 Productivity <span className="text-gray-400">(คำนวณอัตโนมัติ)</span></label>
                            <div role="status" aria-live="polite"
                                aria-label={`Productivity: ${calcProductivity ? calcProductivity + '%' : 'ยังไม่มีข้อมูล'}`}
                                className={`w-full px-3 py-2.5 border-2 rounded-xl text-sm font-bold ${calcProductivity >= 85 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : calcProductivity > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                {calcProductivity ? `${calcProductivity}%` : '-'}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="ipd-cmi" className="text-xs font-bold text-gray-500 mb-1 flex justify-between items-center">
                                <span>CMI</span>
                                {summary.totalBeds ? (
                                    <span className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100" title="จำนวนเตียงจาก HIS">
                                        <i className="fa-solid fa-bed mr-1"></i> {summary.totalBeds} เตียง
                                    </span>
                                ) : null}
                            </label>
                            <input id="ipd-cmi" type="number" step="0.01" min="0" inputMode="decimal"
                                value={summary.cmi || ''}
                                onChange={(e) => handleSummaryChange('cmi', e.target.value)}
                                disabled={readonly}
                                aria-label="ค่า CMI"
                                className={`w-full px-3 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300 text-sm font-bold transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-200 focus:border-teal-500 text-gray-700'}`}
                            />
                            {summary.totalBeds && summary.patientDay ? (
                                <p className="text-[10px] text-gray-400 mt-1 mt-1 text-right">
                                    Pt/Bed Ratio: {((summary.patientDay / summary.totalBeds) * 100).toFixed(1)}%
                                </p>
                            ) : null}
                        </div>
                        <div>
                            <label htmlFor="ipd-cap-status" className="text-xs font-bold text-gray-500 mb-1 block">CAP Assessment</label>
                            <select id="ipd-cap-status" value={summary.capStatus}
                                onChange={(e) => handleSummaryChange('capStatus', e.target.value)}
                                disabled={readonly}
                                aria-label="ระดับ CAP Assessment"
                                className={`w-full px-3 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300 text-sm font-bold transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed appearance-none' : 'bg-white border-gray-200 focus:border-teal-500 text-gray-700'}`}
                            >
                                <option value="suitable">🟢 เหมาะสม</option>
                                <option value="improve">🟡 ปรับปรุง</option>
                                <option value="shortage">🔴 ขาดแคลน</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <div className="bg-indigo-50 rounded-xl px-4 py-2.5 w-full text-center"
                                role="status" aria-live="polite" aria-label={`รวม Staff ต่อวัน: ${totalAllShifts}`}>
                                <span className="text-xs text-gray-500">รวม Staff/วัน</span>
                                <div className="text-2xl font-bold text-indigo-700">{totalAllShifts}</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Status Bar & Actions */}
                {hasExistingData && !isEditing && (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-4"
                        role="status">
                        <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold">
                            <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
                            <span>มีข้อมูลของวันนี้อยู่แล้ว (โหมดดูอย่างเดียว)</span>
                            {lastSavedAt && (
                                <span className="text-xs text-gray-500 ml-2">· บันทึกล่าสุด: {lastSavedAt}</span>
                            )}
                        </div>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
                            aria-label="เข้าสู่โหมดแก้ไขข้อมูล"
                        >
                            <i className="fa-solid fa-pen" aria-hidden="true"></i> แก้ไขข้อมูล
                        </button>
                    </div>
                )}

                {/* Save Button + Unsaved indicator */}
                <div className="flex items-center gap-4 justify-end">
                    {isDirty && (
                        <span className="text-xs text-amber-600 font-semibold flex items-center gap-1" role="status">
                            <i className="fa-solid fa-circle text-[6px]" aria-hidden="true"></i>
                            มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
                        </span>
                    )}
                    {lastSavedAt && isEditing && (
                        <span className="text-xs text-gray-400">บันทึกล่าสุด: {lastSavedAt}</span>
                    )}
                    {(!hasExistingData || isEditing) && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="gradient-header text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:opacity-95 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-70"
                            aria-label={saving ? 'กำลังบันทึกข้อมูล' : (isEditing ? 'อัพเดทข้อมูล' : 'บันทึกข้อมูล')}
                        >
                            {saving ? <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> : <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i>}
                            {saving ? 'กำลังบันทึก...' : (isEditing ? 'อัพเดทข้อมูล' : 'บันทึกข้อมูล')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
