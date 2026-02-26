import React from 'react';

interface HeaderProps {
    dept: 'IPD' | 'OPD';
    setDept: (dept: 'IPD' | 'OPD') => void;
    ward: string;
    setWard: (ward: string) => void;
    date: string;
    setDate: (date: string) => void;
    onRefresh: () => void;
    onOpenSettings: () => void;
    wards: { id: number; name: string }[];
}

export default function Header({ 
    dept, setDept, ward, setWard, date, setDate, 
    onRefresh, onOpenSettings, wards 
}: HeaderProps) {
    return (
        <header className="glass-panel p-4 mb-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="gradient-header p-3 rounded-xl shadow-lg text-white">
                        <i className="fa-solid fa-user-nurse text-2xl"></i>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Nursing Organization Dashboard</h1>
                        <p className="text-xs text-gray-500">Real-time Workforce Monitoring & Analytics</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    
                    {/* Department Type Selector */}
                    <div className="flex items-center bg-white rounded-xl px-4 py-2 border-2 border-indigo-200 shadow-sm">
                        <i className="fa-solid fa-layer-group text-indigo-500 mr-2"></i>
                        <label className="text-xs text-gray-500 mr-2 font-semibold">ประเภท:</label>
                        <select 
                            value={dept} 
                            onChange={(e) => setDept(e.target.value as 'IPD' | 'OPD')} 
                            className="text-sm font-bold text-indigo-700 bg-transparent outline-none cursor-pointer"
                        >
                            <option value="IPD">ผู้ป่วยใน (IPD)</option>
                            <option value="OPD">ผู้ป่วยนอก (OPD)</option>
                        </select>
                    </div>

                    {/* Ward Selector - ใช้ ID เป็น value */}
                    <div className="flex items-center bg-white rounded-xl px-4 py-2 border border-gray-200 shadow-sm">
                        <i className="fa-solid fa-hospital-user text-gray-400 mr-2"></i>
                        <label className="text-xs text-gray-500 mr-2">หน่วยงาน:</label>
                        <select 
                            value={ward} 
                            onChange={(e) => setWard(e.target.value)} 
                            className="text-sm font-semibold text-gray-700 bg-transparent outline-none cursor-pointer min-w-[150px]"
                        >
                            <option value="all">📊 ภาพรวม (All)</option>
                            {wards.map((w) => (
                                <option key={w.id} value={String(w.id)}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Selector - dd/mm/yyyy format */}
                    <div className="flex items-center bg-white rounded-xl px-4 py-2 border border-gray-200 shadow-sm">
                        <i className="fa-regular fa-calendar text-gray-400 mr-2"></i>
                        <label className="text-xs text-gray-500 mr-2">วันที่:</label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={date} 
                                onChange={(e) => setDate(e.target.value)} 
                                onKeyDown={(e) => e.preventDefault()}
                                className="text-sm font-semibold bg-transparent outline-none cursor-pointer text-transparent w-[130px]"
                            />
                            <div className="absolute inset-0 flex items-center pointer-events-none text-sm font-semibold text-gray-700">
                                {date ? date.split('-').reverse().join('/') : ''}
                            </div>
                        </div>
                    </div>

                    {/* Settings Button */}
                    {/* <button onClick={onOpenSettings} className="bg-white text-gray-600 hover:text-indigo-600 border border-gray-200 w-10 h-10 rounded-xl shadow-sm transition-all flex items-center justify-center mr-2">
                        <i className="fa-solid fa-gear"></i>
                    </button> */}

                    {/* Refresh Button */}
                    <button onClick={onRefresh} className="gradient-header hover:opacity-90 text-white w-10 h-10 rounded-xl shadow-lg transition-all flex items-center justify-center">
                        <i className="fa-solid fa-arrows-rotate"></i>
                    </button>
                </div>
            </div>
        </header>
    );
}
