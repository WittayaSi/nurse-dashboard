import React from 'react';
import Link from 'next/link';

interface HeaderProps {
    dept: 'IPD' | 'OPD';
    setDept: (dept: 'IPD' | 'OPD') => void;
    ward: string;
    setWard: (ward: string) => void;
    date: string;
    setDate: (date: string) => void;
    onRefresh: () => void;
    onOpenSettings?: () => void;
    wards: { id: number; name: string }[];
}

export default function Header({
    dept, setDept, ward, setWard, date, setDate,
    onRefresh, wards
}: HeaderProps) {
    return (
        <header className="glass-panel p-4 mb-6 animate-slideUp">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* Branding / Title */}
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-indigo-500 to-teal-400 w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                        <i className="fa-solid fa-user-nurse text-xl"></i>
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-gray-800 leading-tight">Nursing Organization</h1>
                        <p className="text-xs text-gray-500">Workforce Dashboard &amp; Monitoring</p>
                    </div>
                </div>

                {/* Filters & Actions */}
                <div className="flex flex-wrap items-center gap-2 lg:gap-3 w-full lg:w-auto">

                    {/* Department Type Selector */}
                    <div className="flex items-center bg-white rounded-xl px-3 py-2 border-2 border-indigo-200 shadow-sm hover:border-indigo-300 transition-colors">
                        <i className="fa-solid fa-layer-group text-indigo-500 mr-2 text-sm"></i>
                        <label className="text-xs text-gray-500 mr-2 font-semibold hidden sm:inline">ประเภท:</label>
                        <select
                            value={dept}
                            onChange={(e) => setDept(e.target.value as 'IPD' | 'OPD')}
                            className="text-sm font-bold text-indigo-700 bg-transparent outline-none cursor-pointer"
                        >
                            <option value="IPD">ผู้ป่วยใน (IPD)</option>
                            <option value="OPD">ผู้ป่วยนอก (OPD)</option>
                        </select>
                    </div>

                    {/* Ward Selector */}
                    <div className="flex items-center bg-white rounded-xl px-3 py-2 border border-gray-200 shadow-sm hover:border-gray-300 transition-colors flex-1 sm:flex-none">
                        <i className="fa-solid fa-hospital-user text-gray-400 mr-2 text-sm"></i>
                        <label className="text-xs text-gray-500 mr-2 hidden sm:inline">หน่วยงาน:</label>
                        <select
                            value={ward}
                            onChange={(e) => setWard(e.target.value)}
                            className="text-sm font-semibold text-gray-700 bg-transparent outline-none cursor-pointer min-w-[120px] sm:min-w-[150px]"
                        >
                            <option value="all">📊 ภาพรวม (All)</option>
                            {wards.map((w) => (
                                <option key={w.id} value={String(w.id)}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center bg-white rounded-xl px-3 py-2 border border-gray-200 shadow-sm relative group focus-within:border-indigo-400 hover:border-gray-300 transition-colors">
                        <i className="fa-regular fa-calendar text-gray-400 mr-2 group-hover:text-indigo-500 transition-colors pointer-events-none text-sm"></i>
                        <label htmlFor="header-date" className="text-xs text-gray-500 mr-2 pointer-events-none whitespace-nowrap hidden sm:inline">วันที่:</label>
                        <div className="relative flex items-center w-[110px] sm:w-[130px]">
                            <input
                                id="header-date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                onKeyDown={(e) => e.preventDefault()}
                                className="w-full h-full bg-transparent outline-none cursor-pointer date-input-full-picker text-transparent"
                                aria-label="วันที่"
                            />
                            <div className="absolute inset-0 flex justify-between items-center text-sm font-semibold text-gray-700 pointer-events-none px-1">
                                <span>{date ? date.split('-').reverse().join('/') : ''}</span>
                                <i className="fa-regular fa-calendar-days text-gray-400 group-hover:text-indigo-500 transition-colors text-xs"></i>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                        {/* Quick Input Link */}
                        <Link
                            href={dept === 'IPD' ? `/input/ipd?date=${date}` : `/input/opd?date=${date}`}
                            className="quick-action-btn bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200/50 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95"
                            title={`บันทึกข้อมูล ${dept}`}
                        >
                            <i className="fa-solid fa-pen-to-square text-xs"></i>
                            <span className="hidden sm:inline">บันทึก {dept}</span>
                        </Link>

                        {/* Settings Link */}
                        <Link
                            href="/settings"
                            className="bg-white text-gray-600 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 w-10 h-10 rounded-xl shadow-sm transition-all flex items-center justify-center active:scale-95"
                            title="ตั้งค่าและรายงาน (Settings)"
                            aria-label="ตั้งค่าและรายงาน"
                        >
                            <i className="fa-solid fa-gear text-sm"></i>
                        </Link>

                        {/* Refresh Button */}
                        <button
                            onClick={onRefresh}
                            className="gradient-header hover:opacity-90 text-white w-10 h-10 rounded-xl shadow-lg transition-all flex items-center justify-center active:scale-95"
                            title="รีเฟรชข้อมูล"
                            aria-label="รีเฟรชข้อมูล"
                        >
                            <i className="fa-solid fa-arrows-rotate text-sm"></i>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
