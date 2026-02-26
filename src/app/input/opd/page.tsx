'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Ward {
    id: number;
    code: string;
    name: string;
    deptType: string;
}

interface ShiftData {
    rnCount: number;
    nonRnCount: number;
    patientTotal: number;
    triage1: number;
    triage2: number;
    triage3: number;
    triage4: number;
    triage5: number;
    ivpCount: number;
    emsCount: number;
    lrCount: number;
}

interface ToastMessage {
    id: number;
    type: 'success' | 'error';
    text: string;
}

const emptyShift = (): ShiftData => ({
    rnCount: 0, nonRnCount: 0, patientTotal: 0,
    triage1: 0, triage2: 0, triage3: 0, triage4: 0, triage5: 0,
    ivpCount: 0, emsCount: 0, lrCount: 0,
});

const calcWorkload = (s: ShiftData) =>
    (s.triage1 * 3.2) + (s.triage2 * 2.5) + (s.triage3 * 1.0) +
    (s.triage4 * 0.5) + (s.triage5 * 0.25) +
    (s.ivpCount * 2.0) + (s.emsCount * 1.5) + (s.lrCount * 3.5);

const calcPatientTotal = (s: ShiftData) =>
    s.triage1 + s.triage2 + s.triage3 + s.triage4 + s.triage5
    + s.ivpCount + s.emsCount + s.lrCount;

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
    const [wards, setWards] = useState<Ward[]>([]);
    const [selectedWard, setSelectedWard] = useState<number>(0);
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [shifts, setShifts] = useState<{ morning: ShiftData; afternoon: ShiftData; night: ShiftData }>({
        morning: emptyShift(), afternoon: emptyShift(), night: emptyShift()
    });
    const [saving, setSaving] = useState(false);
    const [hasExistingData, setHasExistingData] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const toastIdRef = useRef(0);
    const savedDataRef = useRef<{ shifts: typeof shifts } | null>(null);

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

    useEffect(() => {
        fetch('/api/wards?deptType=OPD')
            .then(r => r.json())
            .then(data => {
                setWards(data);
                if (data.length > 0) setSelectedWard(data[0].id);
            })
            .catch(err => console.error('Error loading wards:', err));
    }, []);

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
                        triage1: s.triage1 ?? 0,
                        triage2: s.triage2 ?? 0,
                        triage3: s.triage3 ?? 0,
                        triage4: s.triage4 ?? 0,
                        triage5: s.triage5 ?? 0,
                        ivpCount: s.ivpCount ?? 0,
                        emsCount: s.emsCount ?? 0,
                        lrCount: s.lrCount ?? 0,
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

    const handleChange = (shift: 'morning' | 'afternoon' | 'night', field: keyof ShiftData, value: string) => {
        if (readonly) return;
        setShifts(prev => ({
            ...prev,
            [shift]: { ...prev[shift], [field]: parseInt(value) || 0 }
        }));
    };

    const handleSave = async () => {
        if (!selectedWard) { showToast('error', 'กรุณาเลือกหน่วยงาน'); return; }
        if (!date) { showToast('error', 'กรุณาเลือกวันที่'); return; }

        const shiftNames = { morning: 'เช้า', afternoon: 'บ่าย', night: 'ดึก' };
        for (const [key, label] of Object.entries(shiftNames)) {
            const s = shifts[key as keyof typeof shifts];
            if (s.rnCount + s.nonRnCount === 0) {
                showToast('error', `เวร${label}: กรุณากรอกจำนวนบุคลากรอย่างน้อย 1 คน`);
                return;
            }
            if (calcPatientTotal(s) === 0) {
                showToast('error', `เวร${label}: กรุณากรอกจำนวนผู้ป่วย/หัตถการอย่างน้อย 1 รายการ`);
                return;
            }
        }

        // Confirmation dialog for update mode
        if (isEditing) {
            const wardName = wards.find(w => w.id === selectedWard)?.name || '';
            const confirmed = window.confirm(
                `ยืนยันการอัพเดทข้อมูล?\n\nหน่วยงาน: ${wardName}\nวันที่: ${date.split('-').reverse().join('/')}\n\nข้อมูลเดิมจะถูกเขียนทับ`
            );
            if (!confirmed) return;
        }

        setSaving(true);
        try {
            const payload = ['morning', 'afternoon', 'night'].map(shift => {
                const shiftData = shifts[shift as keyof typeof shifts];
                return {
                    wardId: selectedWard,
                    recordDate: date,
                    shift,
                    ...shiftData,
                    patientTotal: calcPatientTotal(shiftData),
                };
            });

            const res = await fetch('/api/opd/shifts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Failed to save data');

            showToast('success', 'บันทึกข้อมูลสำเร็จ!');
            setIsDirty(false);
            await loadExistingData();
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setSaving(false);
        }
    };

    const shiftLabels = [
        { key: 'morning' as const, label: '☀️ เช้า', bg: 'bg-amber-50' },
        { key: 'afternoon' as const, label: '🌤️ บ่าย', bg: 'bg-blue-50' },
        { key: 'night' as const, label: '🌙 ดึก', bg: 'bg-indigo-50' },
    ];

    const shiftThaiLabels: Record<string, string> = { morning: 'เช้า', afternoon: 'บ่าย', night: 'ดึก' };

    const triageFields: { key: keyof ShiftData; label: string; multiplier: string; color: string }[] = [
        { key: 'triage1', label: 'Level 1', multiplier: 'x3.2', color: 'text-red-600' },
        { key: 'triage2', label: 'Level 2', multiplier: 'x2.5', color: 'text-orange-600' },
        { key: 'triage3', label: 'Level 3', multiplier: 'x1.0', color: 'text-yellow-600' },
        { key: 'triage4', label: 'Level 4', multiplier: 'x0.5', color: 'text-green-600' },
        { key: 'triage5', label: 'Level 5', multiplier: 'x0.25', color: 'text-blue-600' },
    ];

    const procedureFields: { key: keyof ShiftData; label: string; multiplier: string }[] = [
        { key: 'ivpCount', label: 'IVP', multiplier: 'x2.0' },
        { key: 'emsCount', label: 'EMS', multiplier: 'x1.5' },
        { key: 'lrCount', label: 'จินสูตร/LR', multiplier: 'x3.5' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-rose-50 to-orange-50 p-4 md:p-6">
            {/* Toast Notifications */}
            <Toast toasts={toasts} onDismiss={dismissToast} />

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
                        <p className="text-xs text-gray-500">กรอกข้อมูลผู้ป่วยนอก</p>
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
                    <div className="relative">
                        <input
                            id="opd-date-input"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            onKeyDown={(e) => e.preventDefault()}
                            className="w-full px-3 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:border-rose-500 focus:outline-none text-sm font-semibold text-transparent cursor-pointer"
                            aria-label="เลือกวันที่"
                        />
                        <div className="absolute inset-0 flex items-center px-3 pointer-events-none text-sm font-semibold text-gray-800" aria-hidden="true">
                            {date ? date.split('-').reverse().join('/') : ''}
                        </div>
                    </div>
                    {date && (
                        <p className="text-[11px] text-indigo-600 font-semibold mt-1">
                            {new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    )}
                </div>
            </div>

            {/* Loading or Content */}
            {loading ? <LoadingSkeleton /> : (
                <>
                    {/* Per-shift tables */}
                    {shiftLabels.map(({ key, label, bg }) => (
                        <section key={key} className="card-kpi p-0 mb-6 overflow-hidden" aria-label={`ข้อมูลเวร${shiftThaiLabels[key]}`}>
                            <div className={`${bg} px-5 py-3 flex items-center justify-between border-b border-gray-200`}>
                                <span className="font-bold text-gray-700">{label}</span>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-lg"
                                    role="status" aria-live="polite" aria-label={`Workload เวร${shiftThaiLabels[key]}: ${calcWorkload(shifts[key]).toFixed(2)}`}>
                                    Workload: {calcWorkload(shifts[key]).toFixed(2)}
                                </span>
                            </div>
                            <div className="p-4">
                                {/* Staff */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div>
                                        <label htmlFor={`opd-${key}-rn`} className="text-xs font-bold text-pink-600 mb-1 block">RN</label>
                                        <input id={`opd-${key}-rn`} type="number" min="0" inputMode="numeric"
                                            value={shifts[key].rnCount || ''}
                                            onChange={(e) => handleChange(key, 'rnCount', e.target.value)}
                                            disabled={readonly}
                                            aria-label={`RN เวร${shiftThaiLabels[key]}`}
                                            className={`w-full px-3 py-2.5 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 text-center font-bold transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-200 focus:border-pink-400 text-gray-700'}`}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor={`opd-${key}-nonrn`} className="text-xs font-bold text-amber-600 mb-1 block">Non-RN</label>
                                        <input id={`opd-${key}-nonrn`} type="number" min="0" inputMode="numeric"
                                            value={shifts[key].nonRnCount || ''}
                                            onChange={(e) => handleChange(key, 'nonRnCount', e.target.value)}
                                            disabled={readonly}
                                            aria-label={`Non-RN เวร${shiftThaiLabels[key]}`}
                                            className={`w-full px-3 py-2.5 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 text-center font-bold transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-200 focus:border-amber-400 text-gray-700'}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-teal-600 mb-1 block">จำนวน PL <span className="text-gray-400">(อัตโนมัติ)</span></label>
                                        <div className="w-full px-3 py-2.5 bg-teal-50 border-2 border-teal-200 rounded-lg text-center font-bold text-teal-700"
                                            role="status" aria-live="polite" aria-label={`จำนวนผู้ป่วยเวร${shiftThaiLabels[key]}: ${calcPatientTotal(shifts[key])}`}>
                                            {calcPatientTotal(shifts[key])}
                                        </div>
                                    </div>
                                </div>

                                {/* Triage Levels */}
                                <div className="mb-3">
                                    <p className="text-xs font-bold text-gray-500 mb-2">ประเภทผู้ป่วย (Triage)</p>
                                    <div className="grid grid-cols-5 gap-2">
                                        {triageFields.map(({ key: fKey, label: fLabel, multiplier, color }) => (
                                            <div key={fKey}>
                                                <label htmlFor={`opd-${key}-${fKey}`}
                                                    className={`text-[10px] font-bold ${color} mb-1 block text-center`}>
                                                    {fLabel} <span className="text-gray-400">{multiplier}</span>
                                                </label>
                                                <input id={`opd-${key}-${fKey}`} type="number" min="0" inputMode="numeric"
                                                    value={shifts[key][fKey] || ''}
                                                    onChange={(e) => handleChange(key, fKey, e.target.value)}
                                                    disabled={readonly}
                                                    aria-label={`${fLabel} เวร${shiftThaiLabels[key]}`}
                                                    className={`w-full px-2 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center text-sm font-bold transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-200 focus:border-indigo-400 text-gray-700'}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Procedures */}
                                <div>
                                    <p className="text-xs font-bold text-gray-500 mb-2">หัตถการเพิ่มเติม</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {procedureFields.map(({ key: fKey, label: fLabel, multiplier }) => (
                                            <div key={fKey}>
                                                <label htmlFor={`opd-${key}-${fKey}`}
                                                    className="text-[10px] font-bold text-gray-600 mb-1 block text-center">
                                                    {fLabel} <span className="text-gray-400">{multiplier}</span>
                                                </label>
                                                <input id={`opd-${key}-${fKey}`} type="number" min="0" inputMode="numeric"
                                                    value={shifts[key][fKey] || ''}
                                                    onChange={(e) => handleChange(key, fKey, e.target.value)}
                                                    disabled={readonly}
                                                    aria-label={`${fLabel} เวร${shiftThaiLabels[key]}`}
                                                    className={`w-full px-2 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center text-sm font-bold transition-colors ${readonly ? 'bg-gray-100 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-200 focus:border-indigo-400 text-gray-700'}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    ))}

                    {/* Total Workload */}
                    <section className="card-kpi p-5 mb-6 flex items-center justify-between" aria-label="สรุป Workload">
                        <div>
                            <div className="text-xs font-bold text-gray-500 uppercase">Total Workload Score (ทั้งวัน)</div>
                            <div className="text-3xl font-bold text-rose-600" role="status" aria-live="polite"
                                aria-label={`Workload รวม: ${(calcWorkload(shifts.morning) + calcWorkload(shifts.afternoon) + calcWorkload(shifts.night)).toFixed(2)}`}>
                                {(calcWorkload(shifts.morning) + calcWorkload(shifts.afternoon) + calcWorkload(shifts.night)).toFixed(2)}
                            </div>
                        </div>
                        <div className="text-right text-xs text-gray-500 space-y-0.5">
                            <div>เช้า: <strong>{calcWorkload(shifts.morning).toFixed(2)}</strong></div>
                            <div>บ่าย: <strong>{calcWorkload(shifts.afternoon).toFixed(2)}</strong></div>
                            <div>ดึก: <strong>{calcWorkload(shifts.night).toFixed(2)}</strong></div>
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

                    {/* Save Button */}
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
                </>
            )}
        </div>
    );
}
