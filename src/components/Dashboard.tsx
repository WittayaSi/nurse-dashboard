'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from './Header';
import HeroCard from './HeroCard';
import StatCard from './StatCard';
import WardChart from './Charts/WardChart';
import SkillMixChart from './Charts/SkillMixChart';
import CapStatusChart from './Charts/CapStatusChart';
import LoadingOverlay from './LoadingOverlay';

interface DashboardData {
    deptType: 'IPD' | 'OPD';
    date: string;
    productivity: number;
    totalWorkforce: number;
    cmi: number;
    patientVisit: number;
    shifts: {
        morning: { rn: number; nonRn: number };
        afternoon: { rn: number; nonRn: number };
        midnight: { rn: number; nonRn: number };
    };
    workforce: { rn: number; nonRn: number };
    skillMix: { total: number; onDuty: number; ratio: string };
    capStatus: { suitable: number; improve: number; shortage: number };
    wardData: { name: string; prod: number }[];
}

const initialData: DashboardData = {
    deptType: 'IPD',
    date: '',
    productivity: 0,
    totalWorkforce: 0,
    cmi: 0,
    patientVisit: 0,
    shifts: {
        morning: { rn: 0, nonRn: 0 },
        afternoon: { rn: 0, nonRn: 0 },
        midnight: { rn: 0, nonRn: 0 }
    },
    workforce: { rn: 0, nonRn: 0 },
    skillMix: { total: 0, onDuty: 0, ratio: '-' },
    capStatus: { suitable: 0, improve: 0, shortage: 0 },
    wardData: []
};

export default function Dashboard() {
    const [dept, setDept] = useState<'IPD' | 'OPD'>('IPD');
    const [ward, setWard] = useState<string>('all');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState<boolean>(false);
    const [data, setData] = useState<DashboardData>(initialData);
    const [wards, setWards] = useState<{ id: number; name: string; code: string }[]>([]);

    // Load wards from DB
    useEffect(() => {
        const loadWards = async () => {
            try {
                const res = await fetch(`/api/wards?deptType=${dept}`);
                const wardData = await res.json();
                setWards(wardData);
            } catch (err) {
                console.error('Error loading wards:', err);
            }
        };
        loadWards();
    }, [dept]);

    // Fetch dashboard data
    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ deptType: dept });
            if (date) params.set('date', date);
            if (ward !== 'all') params.set('wardId', ward);

            const res = await fetch(`/api/dashboard?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch dashboard data');

            const result = await res.json();
            setData({ ...result, deptType: dept });

            // If no date was set, use the date from the API response (latest)
            if (!date && result.date) {
                setDate(result.date);
            }
        } catch (error: any) {
            console.error('Dashboard fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [dept, ward, date]);

    // Fetch on mount and when filters change
    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const wardOptions = wards.map(w => ({ id: w.id, name: w.name }));

    return (
        <div className="p-4 md:p-6 min-h-screen">
            <LoadingOverlay isLoading={loading} />
            
            <Header 
                dept={dept} setDept={(d) => { setDept(d); setWard('all'); }}
                ward={ward} setWard={setWard}
                date={date} setDate={setDate}
                onRefresh={fetchDashboard}
                onOpenSettings={() => window.open('/settings', '_blank')}
                wards={wardOptions}
            />

            
            {/* Main Grid with smooth transition */}
            <div key={`${dept}-${ward}-${date}`} className="animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: KPIs & Workforce */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    
                    {/* Hero Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <HeroCard 
                            title="Productivity" 
                            value={`${data.productivity}%`} 
                            subtitle="Target" 
                            target="85%"
                            icon="fa-solid fa-chart-line"
                            gradient="linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #2dd4bf 100%)"
                        />
                        {dept === 'IPD' ? (
                            <HeroCard 
                                title="CMI" 
                                value={data.cmi} 
                                subtitle="Case Mix Index" 
                                icon="fa-solid fa-weight-scale"
                                gradient="linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)"
                            />
                        ) : (
                            <HeroCard 
                                title="Patient Visit" 
                                value={data.patientVisit.toLocaleString()} 
                                subtitle="ผู้ป่วยต่อวัน" 
                                icon="fa-solid fa-user-group"
                                gradient="linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)"
                            />
                        )}
                    </div>
                    
                    {/* Workforce Card */}
                    <StatCard 
                        title="Total Workforce" 
                        value={data.totalWorkforce.toLocaleString()} 
                        subtitle="พยาบาลทั้งหมด" 
                        icon="fa-solid fa-users"
                        colorClass="text-indigo-600"
                        bgClass="bg-indigo-100"
                    />
                    
                    {/* Workforce Status Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-gradient-to-b from-pink-500 to-pink-600 rounded-full"></div>
                            <h2 className="font-bold text-gray-800">Workforce Status</h2>
                            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">{dept}</span>
                        </div>
                    </div>

                    {/* IPD Table or OPD Grid */}
                    {dept === 'IPD' ? (
                        <div className="flex flex-col gap-4">
                            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 font-semibold">
                                        <tr>
                                            <th className="px-4 py-3">เวร (Shift)</th>
                                            <th className="px-4 py-3 text-center"><span className="text-pink-600">RN</span></th>
                                            <th className="px-4 py-3 text-center"><span className="text-amber-600">PN/NA</span></th>
                                            <th className="px-4 py-3 text-center">รวม</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr className="hover:bg-orange-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-700">☀️ เช้า</td>
                                            <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.morning.rn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.morning.nonRn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.morning.rn + data.shifts.morning.nonRn}</td>
                                        </tr>
                                        <tr className="hover:bg-blue-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-700">🌤️ บ่าย</td>
                                            <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.afternoon.rn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.afternoon.nonRn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.afternoon.rn + data.shifts.afternoon.nonRn}</td>
                                        </tr>
                                        <tr className="hover:bg-indigo-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-700">🌙 ดึก</td>
                                            <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.midnight.rn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.midnight.nonRn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.midnight.rn + data.shifts.midnight.nonRn}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Staff Mix Ratio */}
                            <div className="card-kpi p-5 flex items-center justify-between">
                                <div className="flex flex-col gap-2">
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Staff Mix Ratio</div>
                                    <div className="text-3xl font-bold text-pink-600">
                                        {data.skillMix.total > 0 ? ((data.workforce.rn / data.skillMix.total) * 100).toFixed(1) : 0}% RN
                                    </div>
                                    <div className="flex gap-3 text-xs">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-pink-500 rounded-full"></span> RN: <strong>{data.workforce.rn}</strong></span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> PN: <strong>{data.workforce.nonRn}</strong></span>
                                    </div>
                                </div>
                                <div className="w-28 h-28 relative">
                                    <SkillMixChart rn={data.workforce.rn} pn={data.workforce.nonRn} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <StatCard 
                                title="พยาบาล (RN)" 
                                value={data.workforce.rn} 
                                subtitle="คน" 
                                icon="fa-solid fa-user-nurse"
                                colorClass="text-pink-600"
                                bgClass="bg-pink-50"
                            />
                            <StatCard 
                                title="ผู้ช่วย (PN/NA)" 
                                value={data.workforce.nonRn} 
                                subtitle="คน" 
                                icon="fa-solid fa-user-gear"
                                colorClass="text-amber-600"
                                bgClass="bg-amber-50"
                            />
                        </div>
                    )}
                </div>

                {/* Right Column: Charts */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                    {/* CAP Assessment */}
                    <div className="card-kpi p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-gray-800 font-bold flex items-center gap-2">
                                <i className="fa-solid fa-chart-pie text-indigo-500"></i>
                                CAP Assessment Status
                            </h3>
                            <div className="flex gap-4 text-xs">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> เหมาะสม</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> ปรับปรุง</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> ขาดแคลน</span>
                            </div>
                        </div>
                        <div className="h-48 w-full">
                            <CapStatusChart capData={data.capStatus} />
                        </div>
                    </div>

                    {/* Ward Performance */}
                    <div className="card-kpi p-6 flex-grow flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-gray-800 font-bold flex items-center gap-2">
                                    <i className="fa-solid fa-hospital text-teal-500"></i>
                                    <span>{dept === 'IPD' ? 'Ward Performance (IPD)' : 'Unit Performance (OPD)'}</span>
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">เปรียบเทียบ Productivity ตามหอผู้ป่วย/แผนก</p>
                            </div>
                            <div className="flex flex-col gap-1 text-xs">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-indigo-500"></div> <span className="text-gray-500">Over (&gt;100%)</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-emerald-500"></div> <span className="text-gray-500">Appropriate</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-400"></div> <span className="text-gray-500">Under (&lt;85%)</span></div>
                            </div>
                        </div>

                        <div className="relative w-full flex-grow min-h-[350px]">
                            <WardChart wardData={data.wardData} deptType={dept} />
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
}
