'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import LoadingOverlay from '@/components/LoadingOverlay';

interface Ward {
    id: number;
    code: string;
    name: string;
    deptType: string;
    opdFieldsConfig: OpdFieldsConfig | null;
}

interface FieldConfig {
    key: string;
    label: string;
    multiplier: number;
}

interface FieldGroup {
    name: string;
    fields: FieldConfig[];
}

interface OpdFieldsConfig {
    groups: FieldGroup[];
    shifts: string[]; // e.g. ['morning'], ['morning','afternoon','night']
}

interface ShiftData {
    rnCount: number | null;
    nonRnCount: number | null;
    patientTotal: number | null;
    categoryData: Record<string, number | null>;
}

interface ToastMessage {
    id: number;
    type: 'success' | 'error';
    text: string;
}

const emptyShift = (): ShiftData => ({
    rnCount: null, nonRnCount: null, patientTotal: null,
    categoryData: {},
});

const calcWorkload = (s: ShiftData, config: OpdFieldsConfig | null): number => {
    if (!config) return 0;
    let total = 0;
    for (const group of config.groups) {
        for (const field of group.fields) {
            total += (s.categoryData[field.key] ?? 0) * field.multiplier;
        }
    }
    return total;
};

const calcPatientTotal = (s: ShiftData): number => {
    return Object.values(s.categoryData).reduce<number>((sum, val) => sum + (val ?? 0), 0);
};

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
            {[1, 2, 3].map(i => (
                <div key={i} className="card-kpi p-0 overflow-hidden">
                    <div className="bg-amber-50 px-5 py-3"><div className="h-5 bg-gray-200 rounded w-24"></div></div>
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-3">{[1, 2, 3].map(j => <div key={j} className="h-14 bg-gray-200 rounded-lg"></div>)}</div>
                        <div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map(j => <div key={j} className="h-12 bg-gray-200 rounded-lg"></div>)}</div>
                    </div>
                </div>
            ))}
            <span className="sr-only">กำลังโหลดข้อมูล...</span>
        </div>
    );
}

export default function OPDInputPage() {
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
    const [saving, setSaving] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; wardName: string; dateStr: string } | null>(null);
    const [hasExistingData, setHasExistingData] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const toastIdRef = useRef(0);
    const savedDataRef = useRef<{ shifts: typeof shifts } | null>(null);

    const readonly = hasExistingData && !isEditing;

    // Get current ward config
    const currentWard = wards.find(w => w.id === selectedWard);
    const config = currentWard?.opdFieldsConfig ?? null;
    const shiftOrder: Record<string, number> = { night: 1, morning: 2, afternoon: 3 };
    const rawShifts = config?.shifts ?? ['night', 'morning', 'afternoon'];
    const activeShifts = [...rawShifts].sort((a, b) => (shiftOrder[a] || 99) - (shiftOrder[b] || 99));

    // --- Toast helpers ---
    const showToast = useCallback((type: 'success' | 'error', text: string) => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, type, text }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const dismissToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // --- Unsaved changes warning ---
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
        setIsDirty(JSON.stringify(shifts) !== JSON.stringify(saved.shifts));
    }, [shifts, readonly]);

    // Sync state to URL
    const pathname = usePathname();
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        let changed = false;

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
    }, [selectedWard, currentWard, date, pathname, router, searchParams]);

    useEffect(() => {
        fetch('/api/wards?deptType=OPD')
            .then(r => r.json())
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
            const res = await fetch(`/api/opd/shifts?date=${date}&wardId=${selectedWard}`);
            const data = await res.json();

            const newShifts = { morning: emptyShift(), afternoon: emptyShift(), night: emptyShift() };
            data.forEach((s: any) => {
                const key = s.shift as keyof typeof newShifts;
                if (newShifts[key]) {
                    newShifts[key] = {
                        rnCount: s.rnCount ?? 0,
                        nonRnCount: s.nonRnCount ?? 0,
                        patientTotal: s.patientTotal ?? 0,
                        categoryData: s.categoryData ?? {},
                    };
                }
            });
            setShifts(newShifts);
            setHasExistingData(data.length > 0);
            setIsEditing(false);
            savedDataRef.current = { shifts: newShifts };
            setIsDirty(false);

            if (data.length > 0 && data[0].updatedAt) {
                setLastSavedAt(new Date(data[0].updatedAt).toLocaleString('th-TH', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }));
            } else {
                setLastSavedAt(null);
            }
        } catch (err) {
            console.error('Error loading existing data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStaffChange = (shift: 'morning' | 'afternoon' | 'night', field: 'rnCount' | 'nonRnCount' | 'patientTotal', value: string) => {
        if (readonly) return;
        const parsed = value === '' ? null : parseInt(value);
        setShifts(prev => ({
            ...prev,
            [shift]: { ...prev[shift], [field]: isNaN(parsed as number) ? null : parsed }
        }));
    };

    const handleCategoryChange = (shift: 'morning' | 'afternoon' | 'night', fieldKey: string, value: string) => {
        if (readonly) return;
        const parsed = value === '' ? null : parseInt(value);
        setShifts(prev => ({
            ...prev,
            [shift]: {
                ...prev[shift],
                categoryData: {
                    ...prev[shift].categoryData,
                    [fieldKey]: isNaN(parsed as number) ? null : parsed
                }
            }
        }));
    };

    const handleSave = async () => {
        if (!selectedWard) { showToast('error', 'กรุณาเลือกหน่วยงาน'); return; }
        if (!date) { showToast('error', 'กรุณาเลือกวันที่'); return; }
        if (!config) { showToast('error', 'หน่วยงานนี้ยังไม่ได้ตั้งค่า Workload'); return; }

        // ไม่บังคับต้องกรอกครบทุกเวร กรอกเวรไหนก็บันทึกได้เลย
        const totalStaffAcrossAllShifts = activeShifts.reduce((acc, key) => {
            const s = shifts[key as keyof typeof shifts];
            return acc + (s.rnCount ?? 0) + (s.nonRnCount ?? 0);
        }, 0);

        if (totalStaffAcrossAllShifts === 0) {
            showToast('error', 'กรุณากรอกข้อมูลบุคลากรอย่างน้อย 1 เวร');
            return;
        }

        // Confirmation dialog for update mode
        if (isEditing) {
            const wardName = wards.find(w => w.id === selectedWard)?.name || '';
            setConfirmDialog({ open: true, wardName, dateStr: date.split('-').reverse().join('/') });
            return;
        }

        doSave();
    };

    const doSave = async () => {
        setConfirmDialog(null);

        setSaving(true);
        try {
            const payload = activeShifts.map(shift => {
                const shiftData = shifts[shift as keyof typeof shifts];
                return {
                    wardId: selectedWard,
                    recordDate: date,
                    shift,
                    rnCount: shiftData.rnCount,
                    nonRnCount: shiftData.nonRnCount,
                    patientTotal: calcPatientTotal(shiftData),
                    categoryData: shiftData.categoryData,
                };
            });

            const res = await fetch('/api/opd/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const errData = await res.json();
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
            const res = await fetch(`/api/opd/shifts?date=${yestStr}&wardId=${selectedWard}`);
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
                        rnCount: s.rnCount ?? 0,
                        nonRnCount: s.nonRnCount ?? 0,
                        patientTotal: s.patientTotal ?? 0,
                        categoryData: s.categoryData ?? {},
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
        { key: 'morning' as const, label: '☀️ เช้า', bg: 'bg-amber-50' },
        { key: 'afternoon' as const, label: '🌤️ บ่าย', bg: 'bg-blue-50' },
        { key: 'night' as const, label: '🌙 ดึก', bg: 'bg-indigo-50' },
    ];

    const shiftThaiLabels: Record<string, string> = { morning: 'เช้า', afternoon: 'บ่าย', night: 'ดึก' };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-rose-50 to-orange-50 p-4 md:p-6">
            {/* Toast Notifications */}
            <Toast toasts={toasts} onDismiss={dismissToast} />

            {/* Confirm Dialog */}
            {confirmDialog?.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDialog(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3 text-white">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">ยืนยันการอัพเดทข้อมูล</h3>
                                <p className="text-white/80 text-xs">ข้อมูลเดิมจะถูกเขียนทับ</p>
                            </div>
                        </div>
                        <div className="px-6 py-5 space-y-3">
                            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                                <i className="fa-solid fa-hospital text-teal-500"></i>
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">หน่วยงาน</p>
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
                    <div className="bg-gradient-to-r from-rose-600 to-orange-500 p-3 rounded-xl shadow-lg text-white" aria-hidden="true">
                        <i className="fa-solid fa-truck-medical text-xl"></i>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">บันทึกข้อมูล OPD</h1>
                        <p className="text-xs text-gray-500">กรอกข้อมูลกำลังคนผู้ป่วยนอก</p>
                    </div>
                </div>
                <Link href="/input/ipd" className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                    aria-label="ไปหน้า IPD">
                    <i className="fa-solid fa-arrow-left"></i> <span>IPD</span>
                </Link>
            </header>

            {/* Filters */}
            <div className="glass-panel p-4 mb-6 flex flex-wrap gap-4 items-end" role="search" aria-label="ตัวกรองข้อมูล">
                <div className="flex-1 min-w-[200px]">
                    <label htmlFor="opd-ward-select" className="text-xs font-bold text-gray-600 mb-1 block">🏥 หน่วยงาน</label>
                    <select
                        id="opd-ward-select"
                        value={selectedWard}
                        onChange={(e) => setSelectedWard(parseInt(e.target.value))}
                        className="w-full px-3 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-rose-500 focus:outline-none text-sm font-semibold"
                        aria-label="เลือกหน่วยงาน"
                    >
                        {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div className="min-w-[180px]">
                    <label htmlFor="opd-date-input" className="text-xs font-bold text-gray-600 mb-1 block">📅 วันที่</label>
                    <div className="relative group flex items-center bg-white border-2 border-gray-200 rounded-xl hover:border-rose-500 transition-colors focus-within:border-rose-500 h-[46px] cursor-pointer">
                        {/* The actual native input is the single source of truth for clicks */}
                        <input
                            id="opd-date-input"
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
                            <i className="fa-regular fa-calendar-days text-gray-400 group-hover:text-rose-500 transition-colors"></i>
                        </div>
                    </div>
                    {date && (
                        <p className="text-[11px] text-indigo-600 font-semibold mt-1">
                            {new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    )}
                </div>

                <div className="flex items-end">
                    <button
                        onClick={copyFromYesterday}
                        disabled={loading || readonly || !selectedWard || !date}
                        className="h-[46px] px-4 bg-white border-2 border-rose-100 hover:border-rose-300 hover:bg-rose-50 text-rose-600 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                        aria-label="คัดลอกเวรจากเมื่อวาน"
                        title="คัดลอกข้อมูลเวรจากเมื่อวาน"
                        type="button"
                    >
                        <i className="fa-solid fa-copy group-hover:scale-110 transition-transform"></i>
                        <span className="hidden sm:inline">คัดลอกเวรจากเมื่อวาน</span>
                    </button>
                </div>
            </div>

            <LoadingOverlay isLoading={loading} message="กำลังดึงข้อมูล OPD..." />

            {/* Content always visible, just overlaid when loading */}
            <div className={`transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                {/* Per-shift data — all shifts in one row */}
                {config && (() => {
                    const visibleShifts = activeShifts.map(key => shiftLabels.find(s => s.key === key)!);
                    return (
                        <section className="card-kpi p-0 mb-6 overflow-hidden">
                            {/* Shift column headers */}
                            <div className={`grid border-b border-gray-200`} style={{ gridTemplateColumns: `140px repeat(${visibleShifts.length}, 1fr)` }}>
                                <div className="bg-gray-50 px-3 py-2"></div>
                                {visibleShifts.map(({ key, label, bg }) => (
                                    <div key={key} className={`${bg} px-3 py-2 text-center border-l border-gray-200`}>
                                        <span className="font-bold text-gray-700 text-sm">{label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 space-y-3">
                                {/* Staff rows */}
                                {([
                                    { field: 'rnCount' as const, label: 'RN', color: 'text-pink-600' },
                                    { field: 'nonRnCount' as const, label: 'Non-RN', color: 'text-amber-600' },
                                ]).map(staff => (
                                    <div key={staff.field} className="grid items-center gap-2" style={{ gridTemplateColumns: `140px repeat(${visibleShifts.length}, 1fr)` }}>
                                        <div className={`text-xs font-bold ${staff.color} px-1`}>{staff.label}</div>
                                        {visibleShifts.map(({ key }) => (
                                            <input key={key} type="number" min="0" inputMode="numeric"
                                                value={shifts[key][staff.field] ?? ''}
                                                onChange={(e) => handleStaffChange(key, staff.field, e.target.value)}
                                                disabled={readonly}
                                                className={`w-full px-1 py-1.5 border rounded-lg text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-pink-300 transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-200 text-gray-700'}`}
                                            />
                                        ))}
                                    </div>
                                ))}

                                {/* Patient total row — auto-calculated */}
                                <div className="grid items-center gap-2" style={{ gridTemplateColumns: `140px repeat(${visibleShifts.length}, 1fr)` }}>
                                    <div className="text-xs font-bold text-teal-600 px-1">จำนวน Pt (รวม)</div>
                                    {visibleShifts.map(({ key }) => {
                                        const computedTotal = calcPatientTotal(shifts[key]);
                                        return (
                                            <input key={key} type="text"
                                                value={computedTotal > 0 ? computedTotal : ''}
                                                readOnly
                                                disabled
                                                title="รวมอัตโนมัติจากหมวดหมู่ย่อย"
                                                className="w-full px-1 py-1.5 border rounded-lg text-center text-sm font-bold bg-teal-50 border-teal-100 text-teal-700 cursor-not-allowed opacity-90"
                                            />
                                        );
                                    })}
                                </div>

                                {/* Separator */}
                                <hr className="border-gray-100" />

                                {/* Dynamic Category Fields — one row per field */}
                                {config.groups.map((group, gi) => (
                                    <div key={gi}>
                                        <p className="text-xs font-bold text-gray-400 mb-2">{group.name}</p>
                                        {group.fields.map((field) => (
                                            <div key={field.key} className="grid items-center gap-2 mb-1.5" style={{ gridTemplateColumns: `140px repeat(${visibleShifts.length}, 1fr)` }}>
                                                <div className="text-[11px] font-bold text-gray-600 px-1 truncate" title={field.label}>
                                                    {field.label} <span className="text-gray-400 font-normal">×{field.multiplier}</span>
                                                </div>
                                                {visibleShifts.map(({ key }) => (
                                                    <input key={key}
                                                        type="number" min="0" inputMode="numeric"
                                                        value={shifts[key].categoryData[field.key] ?? ''}
                                                        onChange={(e) => handleCategoryChange(key, field.key, e.target.value)}
                                                        disabled={readonly}
                                                        className={`w-full px-1 py-1.5 border rounded-lg text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-200 text-gray-700'}`}
                                                    />
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </section>
                    );
                })()}

                {/* Productivity Summary (LR Standard) */}
                {config && (() => {
                    const sumWorkload = activeShifts.reduce((sum, s) => sum + calcWorkload(shifts[s as keyof typeof shifts], config), 0);
                    const expectStaff = sumWorkload / 7;
                    let actualRN = 0;
                    let actualNonRN = 0;
                    activeShifts.forEach(s => {
                        actualRN += shifts[s as keyof typeof shifts].rnCount || 0;
                        actualNonRN += shifts[s as keyof typeof shifts].nonRnCount || 0;
                    });
                    const actualStaff = actualRN + actualNonRN;
                    const totalProductivity = actualStaff > 0 ? (expectStaff / actualStaff) * 100 : 0;

                    return (
                        <section className="card-kpi p-0 mb-6 overflow-hidden" aria-label="สรุปอัตรากำลังและ Productivity">
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-3 text-white flex items-center gap-2">
                                <i className="fa-solid fa-users-gear" aria-hidden="true"></i>
                                <span className="font-bold">สรุปอัตรากำลัง (Productivity)</span>
                            </div>

                            {/* Per-Shift Summaries */}
                            <div className="divide-y divide-emerald-100/50">
                                {activeShifts.map(s => {
                                    const shiftData = shifts[s as keyof typeof shifts];
                                    const wl = calcWorkload(shiftData, config);
                                    const exp = wl / 7;
                                    const actRN = shiftData.rnCount || 0;
                                    const actNonRN = shiftData.nonRnCount || 0;
                                    const actStaff = actRN + actNonRN;
                                    const prod = actStaff > 0 ? (exp / actStaff) * 100 : 0;

                                    return (
                                        <div key={s} className="p-4 grid grid-cols-2 md:grid-cols-5 items-center gap-4 bg-white hover:bg-emerald-50/30 transition-colors">
                                            <div className="font-bold text-gray-700 md:w-16 text-center bg-gray-100 rounded-lg py-1 text-sm md:mx-auto col-span-2 md:col-span-1">เวร{shiftThaiLabels[s]}</div>
                                            <div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase">Nursing Need</div>
                                                <div className="text-sm font-bold text-gray-700">{wl.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-bold text-emerald-600 uppercase">Expect</div>
                                                <div className="text-sm font-bold text-emerald-700">{exp.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-bold text-indigo-500 uppercase">Actual</div>
                                                <div className="text-sm font-bold text-indigo-600">{actStaff} <span className="text-[10px] font-normal text-indigo-400">({actRN}+{actNonRN})</span></div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-bold text-purple-600 uppercase">Productivity</div>
                                                <div className={`text-sm font-bold ${prod >= 85 ? 'text-emerald-500' : prod > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                    {prod > 0 ? prod.toFixed(2) + '%' : '-'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Total Summary */}
                            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 bg-emerald-50 border-t-2 border-emerald-100">
                                <div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase">Nursing Need (รวม)</div>
                                    <div className="text-xl font-bold text-gray-700">{sumWorkload.toFixed(2)}</div>
                                    <div className="text-[10px] text-gray-500">ภาระงานรวมทั้งหมด</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-emerald-600 uppercase">Expect (รวม)</div>
                                    <div className="text-xl font-bold text-emerald-700">{expectStaff.toFixed(2)}</div>
                                    <div className="text-[10px] text-emerald-600/70">Need / 7 ชม.</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-indigo-500 uppercase">Actual (รวม)</div>
                                    <div className="text-xl font-bold text-indigo-600">{actualStaff} <span className="text-xs font-normal text-indigo-400">(RN {actualRN} + Non-RN {actualNonRN})</span></div>
                                    <div className="text-[10px] text-indigo-400">บุคลากรรวมทั้งหมด</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold justify-between flex text-purple-600 uppercase">
                                        <span>Productivity % (รวม)</span>
                                    </div>
                                    <div className={`text-xl font-bold ${totalProductivity >= 85 ? 'text-emerald-500' : totalProductivity > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                        {totalProductivity > 0 ? totalProductivity.toFixed(2) + '%' : '-'}
                                    </div>
                                    <div className="text-[10px] text-purple-400">(Expect / Actual) × 100</div>
                                </div>
                            </div>
                        </section>
                    );
                })()}

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

                {/* Save Button */}
                {config && (
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
                                className="bg-gradient-to-r from-rose-600 to-orange-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:opacity-95 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-70"
                                aria-label={saving ? 'กำลังบันทึกข้อมูล' : (isEditing ? 'อัพเดทข้อมูล' : 'บันทึกข้อมูล')}
                            >
                                {saving ? <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> : <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i>}
                                {saving ? 'กำลังบันทึก...' : (isEditing ? 'อัพเดทข้อมูล' : 'บันทึกข้อมูล')}
                            </button>
                        )}
                    </div>
                )}

                {/* No config warning */}
                {!config && (
                    <div className="card-kpi p-6 mb-6 text-center">
                        <div className="text-4xl mb-3">⚙️</div>
                        <h3 className="font-bold text-gray-700 mb-2">ยังไม่ได้ตั้งค่า Workload</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            หน่วยงานนี้ยังไม่ได้กำหนดรายการ Workload กรุณาไปตั้งค่าที่หน้าจัดการหน่วยงานก่อน
                        </p>
                        <Link href="/settings/wards"
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all">
                            <i className="fa-solid fa-gear"></i> ไปตั้งค่าหน่วยงาน
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
