'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Ward {
    id: number;
    code: string;
    name: string;
    opdFieldsConfig: any;
}

type DateMode = 'range' | 'month';

export default function ExportOPDPage() {
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

    useEffect(() => {
        fetch('/api/wards?deptType=OPD')
            .then(res => res.json())
            .then((data: Ward[]) => {
                setWards(data);
                setSelectedWardIds(data.map(w => w.id));
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
            const [year, month] = selectedMonth.split('-').map(Number);
            const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0);
            const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
            return { from: firstDay, to: lastDayStr };
        }
    };

    const handleExport = async () => {
        if (selectedWardIds.length === 0) {
            setMessage({ type: 'error', text: 'กรุณาเลือกหน่วยงานอย่างน้อย 1 หน่วยงาน' });
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

            const res = await fetch(`/api/opd/export?${params.toString()}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to export');
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `OPD_Report_${from}_to_${to}.xlsx`;
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-rose-50 to-orange-50 p-4 md:p-6">
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Link href="/" className="text-gray-400 hover:text-rose-600 transition-colors">
                        <i className="fa-solid fa-arrow-left text-lg"></i>
                    </Link>
                    <div className="bg-gradient-to-r from-rose-600 to-orange-500 p-3 rounded-xl shadow-lg text-white">
                        <i className="fa-solid fa-file-excel text-2xl"></i>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Export ข้อมูล OPD</h1>
                        <p className="text-xs text-gray-500">ส่งออกรายงานกำลังคนผู้ป่วยนอกเป็นไฟล์ Excel</p>
                    </div>
                </div>
                <Link href="/export/ipd" className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                    <i className="fa-solid fa-arrow-left"></i> Export IPD
                </Link>
            </header>

            <div className="max-w-2xl mx-auto space-y-6">
                {/* Ward Selection */}
                <div className="card-kpi p-0 overflow-hidden shadow-lg">
                    <div className="bg-gradient-to-r from-rose-600 to-orange-500 px-5 py-3 text-white flex items-center justify-between">
                        <span className="font-bold flex items-center gap-2">
                            <i className="fa-solid fa-hospital"></i> เลือกหน่วยงาน OPD
                        </span>
                        <span className="text-xs opacity-80">{selectedWardIds.length}/{wards.length} เลือก</span>
                    </div>
                    <div className="p-4">
                        <div className="flex gap-2 mb-3">
                            <button onClick={selectAll}
                                className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors">
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
                                            ? 'bg-rose-50 border-rose-300 text-rose-700'
                                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                    <input
                                        type="checkbox"
                                        checked={selectedWardIds.includes(w.id)}
                                        onChange={() => toggleWard(w.id)}
                                        className="w-4 h-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-semibold truncate block">{w.name}</span>
                                        {w.opdFieldsConfig ? (
                                            <span className="text-[10px] text-emerald-600">✓ ตั้งค่าแล้ว</span>
                                        ) : (
                                            <span className="text-[10px] text-gray-400">⚠ ยังไม่ตั้งค่า</span>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                        {wards.length === 0 && (
                            <p className="text-center text-gray-400 text-sm py-4">ยังไม่มีหน่วยงาน OPD</p>
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
                                    <label className="text-xs font-bold text-gray-600 mb-1 block">จากวันที่</label>
                                    <div className="relative">
                                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                                            onKeyDown={(e) => e.preventDefault()}
                                            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm font-semibold text-transparent cursor-pointer"
                                        />
                                        <div className="absolute inset-0 flex items-center px-4 pointer-events-none text-sm font-semibold text-gray-800">
                                            {dateFrom ? dateFrom.split('-').reverse().join('/') : ''}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 mb-1 block">ถึงวันที่</label>
                                    <div className="relative">
                                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                                            onKeyDown={(e) => e.preventDefault()}
                                            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm font-semibold text-transparent cursor-pointer"
                                        />
                                        <div className="absolute inset-0 flex items-center px-4 pointer-events-none text-sm font-semibold text-gray-800">
                                            {dateTo ? dateTo.split('-').reverse().join('/') : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-bold text-gray-600 mb-1 block">เลือกเดือน</label>
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

                        {/* Summary */}
                        <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                            <p className="text-xs text-rose-700 font-semibold flex items-center gap-2 mb-2">
                                <i className="fa-solid fa-circle-info"></i> สรุปที่จะ Export
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-hospital text-rose-500"></i>
                                    <span className="text-gray-600">หน่วยงาน: <strong className="text-rose-700">{selectedWardIds.length} หน่วยงาน</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-calendar text-emerald-500"></i>
                                    <span className="text-gray-600">ช่วง: <strong className="text-emerald-700">
                                        {displayFrom?.split('-').reverse().join('/')} — {displayTo?.split('-').reverse().join('/')}
                                    </strong></span>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">* แต่ละหน่วยงานจะอยู่คนละ Sheet ใน Excel (ตามประเภทผู้ป่วยที่ต่างกัน)</p>
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
                    className="w-full bg-gradient-to-r from-rose-600 to-orange-500 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:opacity-95 transition-all flex items-center justify-center gap-3 text-base active:scale-[0.98] disabled:opacity-70"
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
                    <Link href="/input/opd"
                        className="text-sm text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                        <i className="fa-solid fa-pen"></i> กรอกข้อมูล OPD
                    </Link>
                    <Link href="/export/ipd"
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                        <i className="fa-solid fa-file-excel"></i> Export IPD
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
