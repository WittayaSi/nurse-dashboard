'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

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
        morning: { rn: number; nonRn: number; workload?: number; expect?: number; actual?: number; productivity?: number; hn?: number; rnOnly?: number; tn?: number; na?: number };
        afternoon: { rn: number; nonRn: number; workload?: number; expect?: number; actual?: number; productivity?: number; hn?: number; rnOnly?: number; tn?: number; na?: number };
        midnight: { rn: number; nonRn: number; workload?: number; expect?: number; actual?: number; productivity?: number; hn?: number; rnOnly?: number; tn?: number; na?: number };
    };
    workforce: { rn: number; nonRn: number; hn?: number; rnOnly?: number; tn?: number; na?: number };
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
        morning: { rn: 0, nonRn: 0, workload: 0, expect: 0, actual: 0, productivity: 0, hn: 0, rnOnly: 0, tn: 0, na: 0 },
        afternoon: { rn: 0, nonRn: 0, workload: 0, expect: 0, actual: 0, productivity: 0, hn: 0, rnOnly: 0, tn: 0, na: 0 },
        midnight: { rn: 0, nonRn: 0, workload: 0, expect: 0, actual: 0, productivity: 0, hn: 0, rnOnly: 0, tn: 0, na: 0 }
    },
    workforce: { rn: 0, nonRn: 0 },
    skillMix: { total: 0, onDuty: 0, ratio: '-' },
    capStatus: { suitable: 0, improve: 0, shortage: 0 },
    wardData: []
};

export default function Dashboard() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const initialDept = (searchParams.get('deptType') as 'IPD' | 'OPD') || 'IPD';
    const initialWard = searchParams.get('ward') || 'all';
    const initialDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const [dept, setDept] = useState<'IPD' | 'OPD'>(initialDept);
    const [ward, setWard] = useState<string>(initialWard);
    const [date, setDate] = useState<string>(initialDate);
    const [loading, setLoading] = useState<boolean>(false);
    const [data, setData] = useState<DashboardData>(initialData);
    const [wards, setWards] = useState<{ id: number; name: string; code: string }[]>([]);
    const [target, setTarget] = useState<number>(85);

    // Sync state to URL
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        let changed = false;
        
        if (params.get('deptType') !== dept) { params.set('deptType', dept); changed = true; }
        if (params.get('ward') !== ward) { params.set('ward', ward); changed = true; }
        if (params.get('date') !== date) { params.set('date', date); changed = true; }
        
        if (changed) {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [dept, ward, date, pathname, router, searchParams]);

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
        <div className="px-4 py-1 md:px-6 md:py-2 min-h-screen">
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
            <div className="animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: KPIs & Workforce */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    
                    {/* Hero Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <HeroCard 
                            title="Productivity" 
                            value={`${data.productivity}%`} 
                            subtitle="Target" 
                            target={`${target}%`}
                            icon="fa-solid fa-chart-line"
                            gradient="linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #2dd4bf 100%)"
                            belowTarget={data.productivity > 0 && data.productivity < target}
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

                    {/* Workforce Status Table (Conditional by Dept) */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                            {dept === 'IPD' ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 font-semibold">
                                        <tr>
                                            <th className="px-4 py-3">เวร (Shift)</th>
                                            <th className="px-4 py-3 text-center"><span className="text-indigo-600">HN</span></th>
                                            <th className="px-4 py-3 text-center"><span className="text-pink-600">RN</span></th>
                                            <th className="px-4 py-3 text-center"><span className="text-teal-600">TN</span></th>
                                            <th className="px-4 py-3 text-center"><span className="text-amber-600">NA</span></th>
                                            <th className="px-4 py-3 text-center">รวม</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr className="hover:bg-orange-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-700">☀️ เช้า</td>
                                            <td className="px-4 py-3 text-center font-bold text-indigo-600">{data.shifts.morning.hn || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.morning.rnOnly || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-teal-600">{data.shifts.morning.tn || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.morning.na || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.morning.rn + data.shifts.morning.nonRn}</td>
                                        </tr>
                                        <tr className="hover:bg-blue-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-700">🌤️ บ่าย</td>
                                            <td className="px-4 py-3 text-center font-bold text-indigo-600">{data.shifts.afternoon.hn || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.afternoon.rnOnly || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-teal-600">{data.shifts.afternoon.tn || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.afternoon.na || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.afternoon.rn + data.shifts.afternoon.nonRn}</td>
                                        </tr>
                                        <tr className="hover:bg-indigo-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-700">🌙 ดึก</td>
                                            <td className="px-4 py-3 text-center font-bold text-indigo-600">{data.shifts.midnight.hn || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.midnight.rnOnly || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-teal-600">{data.shifts.midnight.tn || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.midnight.na || 0}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.midnight.rn + data.shifts.midnight.nonRn}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 font-semibold">
                                        <tr>
                                            <th className="px-4 py-3">เวร (Shift)</th>
                                            <th className="px-4 py-3 text-center"><span className="text-pink-600">RN</span></th>
                                            <th className="px-4 py-3 text-center"><span className="text-amber-600">Non-RN</span></th>
                                            <th className="px-4 py-3 text-center">รวม</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {(data.shifts.morning.rn + data.shifts.morning.nonRn > 0 || ward === 'all') && (
                                            <tr className="hover:bg-orange-50/50">
                                                <td className="px-4 py-3 font-semibold text-gray-700">☀️ เช้า</td>
                                                <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.morning.rn}</td>
                                                <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.morning.nonRn}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.morning.rn + data.shifts.morning.nonRn}</td>
                                            </tr>
                                        )}
                                        {(data.shifts.afternoon.rn + data.shifts.afternoon.nonRn > 0 || ward === 'all') && (
                                            <tr className="hover:bg-blue-50/50">
                                                <td className="px-4 py-3 font-semibold text-gray-700">🌤️ บ่าย</td>
                                                <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.afternoon.rn}</td>
                                                <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.afternoon.nonRn}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.afternoon.rn + data.shifts.afternoon.nonRn}</td>
                                            </tr>
                                        )}
                                        {(data.shifts.midnight.rn + data.shifts.midnight.nonRn > 0 || ward === 'all') && (
                                            <tr className="hover:bg-indigo-50/50">
                                                <td className="px-4 py-3 font-semibold text-gray-700">🌙 ดึก</td>
                                                <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.midnight.rn}</td>
                                                <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.midnight.nonRn}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.midnight.rn + data.shifts.midnight.nonRn}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Staff Mix Ratio */}
                        <div className="card-kpi p-5 flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Staff Mix Ratio</div>
                                <div className="text-3xl font-bold text-pink-600">
                                    {data.skillMix.total > 0 ? ((data.workforce.rn / data.skillMix.total) * 100).toFixed(1) : 0}% RN
                                </div>
                                {dept === 'IPD' && data.workforce.hn !== undefined ? (
                                    <div className="flex gap-3 text-xs flex-wrap">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-indigo-500 rounded-full"></span> HN: <strong>{data.workforce.hn}</strong></span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-pink-500 rounded-full"></span> RN: <strong>{data.workforce.rnOnly}</strong></span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-teal-500 rounded-full"></span> TN: <strong>{data.workforce.tn}</strong></span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> NA: <strong>{data.workforce.na}</strong></span>
                                    </div>
                                ) : (
                                    <div className="flex gap-3 text-xs">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-pink-500 rounded-full"></span> RN: <strong>{data.workforce.rn}</strong></span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> Non-RN: <strong>{data.workforce.nonRn}</strong></span>
                                    </div>
                                )}
                            </div>
                            <div className="w-28 h-28 relative">
                                {dept === 'IPD' && data.workforce.hn !== undefined ? (
                                    <SkillMixChart 
                                        rn={data.workforce.rn} 
                                        pn={data.workforce.nonRn}
                                        hn={data.workforce.hn}
                                        rnOnly={data.workforce.rnOnly}
                                        tn={data.workforce.tn}
                                        na={data.workforce.na}
                                    />
                                ) : (
                                    <SkillMixChart rn={data.workforce.rn} pn={data.workforce.nonRn} />
                                )}
                            </div>
                        </div>
                    </div>
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
                            <WardChart key={`wardchart-${dept}`} wardData={data.wardData} deptType={dept} />
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
}
