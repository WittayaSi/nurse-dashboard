'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Ward {
    id: number;
    code: string;
    name: string;
}

type DateMode = 'range' | 'month';

export default function ExportIPDPage() {
    const router = useRouter();
    const [dateMode, setDateMode] = useState<DateMode>('range');
    const [dateFrom, setDateFrom] = useState<string>(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [wards, setWards] = useState<Ward[]>([]);
    const [selectedWardIds, setSelectedWardIds] = useState<number[]>([]);
    const [exporting, setExporting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Load IPD wards
    useEffect(() => {
        fetch('/api/wards?deptType=IPD')
            .then(res => res.json())
            .then((data: Ward[]) => {
                setWards(data);
                setSelectedWardIds(data.map(w => w.id)); // select all by default
            })
            .catch(err => console.error('Error loading wards:', err));
    }, []);

    const toggleWard = (id: number) => {
        setSelectedWardIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const selectAll = () => setSelectedWardIds(wards.map(w => w.id));
    const deselectAll = () => setSelectedWardIds([]);

    const getExportDates = () => {
        if (dateMode === 'range') {
            return { from: dateFrom, to: dateTo };
        } else {
            // month mode: first and last day of month
            const [year, month] = selectedMonth.split('-').map(Number);
            const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0); // last day of month
            const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
            return { from: firstDay, to: lastDayStr };
        }
    };

    const handleExport = async () => {
        if (selectedWardIds.length === 0) {
            setMessage({ type: 'error', text: 'กรุณาเลือกหอผู้ป่วยอย่างน้อย 1 หอ' });
            return;
        }

        const { from, to } = getExportDates();
        if (!from || !to) {
            setMessage({ type: 'error', text: 'กรุณาเลือกวันที่' });
            return;
        }
        if (from > to) {
            setMessage({ type: 'error', text: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด' });
            return;
        }

        setExporting(true);
        setMessage(null);
        try {
            const params = new URLSearchParams({
                dateFrom: from,
                dateTo: to,
                wardIds: selectedWardIds.join(','),
            });

            const res = await fetch(`/api/ipd/export?${params.toString()}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to export');
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `IPD_Report_${from}_to_${to}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            setMessage({ type: 'success', text: '✅ Export สำเร็จ! ไฟล์ถูกดาวน์โหลดแล้ว' });
        } catch (err: any) {
            setMessage({ type: 'error', text: `❌ ${err.message}` });
        } finally {
            setExporting(false);
        }
    };

    const { from: displayFrom, to: displayTo } = getExportDates();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="text-gray-400 hover:text-indigo-600 transition-colors"
                        aria-label="ย้อนกลับ">
                        <i className="fa-solid fa-arrow-left text-lg"></i>
                    </button>
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-3 rounded-xl shadow-lg text-white">
                        <i className="fa-solid fa-file-excel text-2xl"></i>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Export ข้อมูล IPD</h1>
                        <p className="text-xs text-gray-500">ส่งออกรายงานกำลังคนพยาบาลเป็นไฟล์ Excel</p>
                    </div>
                </div>
                <Link href="/export/opd" className="text-sm text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1">
                    Export OPD <i className="fa-solid fa-arrow-right"></i>
                </Link>
            </header>

            <div className="max-w-2xl mx-auto space-y-6">
                {/* Ward Selection */}
                <div className="card-kpi p-0 overflow-hidden shadow-lg">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-500 px-5 py-3 text-white flex items-center justify-between">
                        <span className="font-bold flex items-center gap-2">
                            <i className="fa-solid fa-hospital"></i> เลือกหอผู้ป่วย
                        </span>
                        <span className="text-xs opacity-80">{selectedWardIds.length}/{wards.length} เลือก</span>
                    </div>
                    <div className="p-4">
                        <div className="flex gap-2 mb-3">
                            <button onClick={selectAll}
                                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                                เลือกทั้งหมด
                            </button>
                            <button onClick={deselectAll}
                                className="text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                                ยกเลิกทั้งหมด
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {wards.map(w => (
                                <label key={w.id}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer select-none border-2 transition-all
                                        ${selectedWardIds.includes(w.id)
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                    <input
                                        type="checkbox"
                                        checked={selectedWardIds.includes(w.id)}
                                        onChange={() => toggleWard(w.id)}
                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-semibold truncate">{w.name}</span>
                                </label>
                            ))}
                        </div>
                        {wards.length === 0 && (
                            <p className="text-center text-gray-400 text-sm py-4">ยังไม่มีหอผู้ป่วย IPD</p>
                        )}
                    </div>
                </div>

                {/* Date Selection */}
                <div className="card-kpi p-0 overflow-hidden shadow-lg">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-3 text-white flex items-center justify-between">
                        <span className="font-bold flex items-center gap-2">
                            <i className="fa-solid fa-calendar-days"></i> เลือกช่วงเวลา
                        </span>
                    </div>
                    <div className="p-5 space-y-4">
                        {/* Mode Tabs */}
                        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                            <button
                                onClick={() => setDateMode('range')}
                                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2
                                    ${dateMode === 'range' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <i className="fa-solid fa-calendar-week"></i> ช่วงวันที่
                            </button>
                            <button
                                onClick={() => setDateMode('month')}
                                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2
                                    ${dateMode === 'month' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                <i className="fa-solid fa-calendar"></i> เลือกเดือน
                            </button>
                        </div>

                        {dateMode === 'range' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-600 mb-1 block">📅 จากวันที่</label>
                                    <div className="relative group flex items-center bg-white border-2 border-gray-200 rounded-xl hover:border-emerald-500 transition-colors focus-within:border-emerald-500 h-[46px] cursor-pointer">
                                        {/* The actual native input is the single source of truth for clicks */}
                                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                                            onKeyDown={(e) => e.preventDefault()}
                                            className="w-full h-full bg-transparent px-4 py-3 outline-none cursor-pointer date-input-full-picker text-transparent"
                                        />
                                        {/* The visual overlay sits on top but is completely transparent to clicks */}
                                        <div className="absolute inset-0 flex justify-between items-center px-4 text-sm font-semibold text-gray-800 pointer-events-none">
                                            <span>{dateFrom ? dateFrom.split('-').reverse().join('/') : ''}</span>
                                            <i className="fa-regular fa-calendar-days text-gray-400 group-hover:text-emerald-500 transition-colors"></i>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 mb-1 block">📅 ถึงวันที่</label>
                                    <div className="relative group flex items-center bg-white border-2 border-gray-200 rounded-xl hover:border-emerald-500 transition-colors focus-within:border-emerald-500 h-[46px] cursor-pointer">
                                        {/* The actual native input is the single source of truth for clicks */}
                                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                                            onKeyDown={(e) => e.preventDefault()}
                                            className="w-full h-full bg-transparent px-4 py-3 outline-none cursor-pointer date-input-full-picker text-transparent"
                                        />
                                        {/* The visual overlay sits on top but is completely transparent to clicks */}
                                        <div className="absolute inset-0 flex justify-between items-center px-4 text-sm font-semibold text-gray-800 pointer-events-none">
                                            <span>{dateTo ? dateTo.split('-').reverse().join('/') : ''}</span>
                                            <i className="fa-regular fa-calendar-days text-gray-400 group-hover:text-emerald-500 transition-colors"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-bold text-gray-600 mb-1 block">📅 เลือกเดือน</label>
                                <input type="month" value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm font-semibold cursor-pointer"
                                />
                                {selectedMonth && (
                                    <p className="text-xs text-emerald-600 font-semibold mt-2">
                                        {(() => {
                                            const [y, m] = selectedMonth.split('-').map(Number);
                                            const d = new Date(y, m - 1, 1);
                                            return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
                                        })()}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Summary of selection */}
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-2 mb-2">
                                <i className="fa-solid fa-circle-info"></i> สรุปที่จะ Export
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-hospital text-indigo-500"></i>
                                    <span className="text-gray-600">หอผู้ป่วย: <strong className="text-indigo-700">{selectedWardIds.length} หอ</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-calendar text-emerald-500"></i>
                                    <span className="text-gray-600">ช่วง: <strong className="text-emerald-700">
                                        {displayFrom?.split('-').reverse().join('/')} — {displayTo?.split('-').reverse().join('/')}
                                    </strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold ${message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Export Button */}
                <button
                    onClick={handleExport}
                    disabled={exporting || selectedWardIds.length === 0}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:opacity-95 transition-all flex items-center justify-center gap-3 text-base active:scale-[0.98] disabled:opacity-70"
                >
                    {exporting ? (
                        <>
                            <i className="fa-solid fa-spinner fa-spin text-lg"></i>
                            กำลังสร้างไฟล์...
                        </>
                    ) : (
                        <>
                            <i className="fa-solid fa-file-arrow-down text-lg"></i>
                            Export Excel
                        </>
                    )}
                </button>

                {/* Quick Links */}
                <div className="flex gap-3 justify-center">
                    <Link href="/input/ipd"
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                        <i className="fa-solid fa-pen"></i> กรอกข้อมูล IPD
                    </Link>
                    <Link href="/export/opd"
                        className="text-sm text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                        <i className="fa-solid fa-file-excel"></i> Export OPD
                    </Link>
                    <Link href="/"
                        className="text-sm text-gray-500 hover:text-gray-700 font-semibold flex items-center gap-1 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                        <i className="fa-solid fa-chart-line"></i> Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
