'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

type Ward = {
  id: number;
  name: string;
  deptType: string;
};

type TrendData = {
  date: string;
  productivity: number;
};

type TrendResponse = {
  wardId: number;
  wardName: string;
  deptType: string;
  startDate: string;
  endDate: string;
  days: number;
  data: TrendData[];
};

export default function TrendAnalysisPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState<number | 'none'>('none');
  const [days, setDays] = useState<number>(14);

  const [trendData, setTrendData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configurable reference lines (saved to localStorage)
  const [refLow, setRefLow] = useState<number>(85);
  const [refHigh, setRefHigh] = useState<number>(115);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    // Load config from localStorage
    const savedLow = localStorage.getItem('opdTrendRefLow');
    const savedHigh = localStorage.getItem('opdTrendRefHigh');
    if (savedLow) setRefLow(Number(savedLow));
    if (savedHigh) setRefHigh(Number(savedHigh));

    // Fetch active wards list
    fetch('/api/wards?activeOnly=true')
      .then(res => res.json())
      .then(data => {
        const wardList = Array.isArray(data) ? data : (data?.data || []);
        if (wardList.length > 0) {
          setWards(wardList);
          setSelectedWard(wardList[0].id);
        }
      })
      .catch(err => console.error('Failed to load wards', err));
  }, []);

  const saveConfig = (low: number, high: number) => {
    setRefLow(low);
    setRefHigh(high);
    localStorage.setItem('opdTrendRefLow', low.toString());
    localStorage.setItem('opdTrendRefHigh', high.toString());
  };

  const fetchTrendData = useCallback(async () => {
    if (selectedWard === 'none') {
      setTrendData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/trend?wardId=${selectedWard}&days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch trend data');
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setTrendData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedWard, days]);

  useEffect(() => {
    fetchTrendData();
  }, [fetchTrendData]);

  // Format date for X-Axis (e.g. "04 Mar")
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-gray-400 hover:text-indigo-600 transition-colors">
            <i className="fa-solid fa-arrow-left text-lg"></i>
          </Link>
          <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 w-12 h-12 flex justify-center items-center rounded-xl shadow-lg text-white">
            <i className="fa-solid fa-chart-line text-2xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">วิเคราะห์แนวโน้ม (Trend Analysis)</h1>
            <p className="text-xs text-gray-500">กราฟแสดง Productivity % ย้อนหลังเพื่อดูความหนาแน่นของภาระงาน</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Settings Toggle */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center justify-center w-10 h-10 rounded-xl border-2 transition-colors ${showConfig ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-100 text-gray-400 hover:text-indigo-500 hover:border-indigo-100 shadow-sm'}`}
            title="ตั้งค่าเส้นอ้างอิง"
          >
            <i className="fa-solid fa-gear"></i>
          </button>

          {/* Days Filter */}
          <div className="flex items-center bg-white rounded-xl p-1 border-2 border-indigo-100 shadow-sm">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-sm font-bold rounded-lg transition-colors ${days === d ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {d} วัน
              </button>
            ))}
          </div>

          {/* Ward Filter */}
          <div className="flex items-center bg-white rounded-xl px-4 py-2 border-2 border-indigo-100 shadow-sm focus-within:border-indigo-500 transition-colors">
            <i className="fa-solid fa-hospital text-indigo-500 mr-2"></i>
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value === 'none' ? 'none' : parseInt(e.target.value))}
              className="text-sm font-bold text-gray-700 bg-transparent outline-none cursor-pointer max-w-[200px]"
            >
              <option value="none" disabled>-- เลือกหน่วยงาน --</option>
              {wards.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.deptType})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 mb-6 flex flex-wrap items-end gap-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">โซนสีแดง (คนขาด / ภาระงานสูง) {'>'} %</label>
            <div className="relative">
              <input
                type="number"
                value={refHigh}
                onChange={(e) => saveConfig(refLow, Number(e.target.value))}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-red-600 outline-none focus:border-red-300 w-32"
              />
              <span className="absolute right-3 top-2 text-gray-400 font-bold">%</span>
            </div>
          </div>
          <div className="hidden md:block text-gray-300 mx-2 text-2xl font-light">|</div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">โซนสีเหลือง (คนเกิน / ภาระงานน้อย) {'<'} %</label>
            <div className="relative">
              <input
                type="number"
                value={refLow}
                onChange={(e) => saveConfig(Number(e.target.value), refHigh)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-amber-600 outline-none focus:border-amber-300 w-32"
              />
              <span className="absolute right-3 top-2 text-gray-400 font-bold">%</span>
            </div>
          </div>
          <div className="ml-auto text-xs text-gray-400 flex items-center gap-2">
            <i className="fa-solid fa-circle-info"></i> ค่าเริ่มต้นคือ 85% และ 115%
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-gray-900 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <i className="fa-solid fa-chart-area text-fuchsia-400"></i> แนวโน้ม Productivity {days} วันล่าสุด
            </h2>
            {trendData && (
              <p className="text-xs text-gray-400 mt-1">
                ข้อมูลวันที่ {formatDate(trendData.startDate)} ถึง {formatDate(trendData.endDate)}
              </p>
            )}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
              <i className="fa-solid fa-circle-notch fa-spin text-4xl mb-3"></i>
              <p className="font-semibold animate-pulse">กำลังดึงข้อมูลกราฟ...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-red-500 bg-red-50 rounded-xl border border-red-100">
              <i className="fa-solid fa-circle-exclamation text-4xl mb-3"></i>
              <p className="font-bold">{error}</p>
              <button onClick={fetchTrendData} className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 transition-colors">
                โหลดข้อมูลใหม่
              </button>
            </div>
          ) : selectedWard === 'none' ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50 rounded-xl">
              <i className="fa-solid fa-hand-pointer text-5xl mb-3 text-gray-300"></i>
              <p className="font-bold text-lg text-gray-500">กรุณาเลือกหน่วยงาน</p>
              <p className="text-sm">เลือกหน่วยงานจาก Dropdown ด้านบนเพื่อดูกราฟ</p>
            </div>
          ) : !trendData || trendData.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <i className="fa-solid fa-chart-line text-5xl mb-3 text-gray-300"></i>
              <p className="font-bold text-lg text-gray-500">ไม่พบข้อมูลของหน่วยงานนี้</p>
              <p className="text-sm">ในช่วง {days} วันที่ผ่านมา ไม่มีการบันทึกข้อมูลของ {wards.find(w => w.id === selectedWard)?.name}</p>
            </div>
          ) : (
            <div className="w-full h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData.data}
                  margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }}
                    domain={[0, 'dataMax + 20']}
                    tickFormatter={(value: number) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                    labelFormatter={(label: any) => `วันที่: ${formatDate(label as string)}`}
                    formatter={(value: any) => {
                      const numVal = typeof value === 'number' ? value : parseFloat(value as string);
                      return [`${numVal.toFixed(2)}%`, 'Productivity'];
                    }}
                  />

                  {/* Reference Lines */}
                  <ReferenceLine y={refHigh} stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'top', value: `สูง (${refHigh}%)`, fill: '#EF4444', fontSize: 12, fontWeight: 'bold' }} />
                  <ReferenceLine y={refLow} stroke="#F59E0B" strokeDasharray="3 3" label={{ position: 'bottom', value: `ต่ำ (${refLow}%)`, fill: '#F59E0B', fontSize: 12, fontWeight: 'bold' }} />

                  {/* The Data Line */}
                  <Line
                    type="monotone"
                    dataKey="productivity"
                    stroke="#8B5CF6"
                    strokeWidth={4}
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                    activeDot={{ r: 7, strokeWidth: 0, fill: '#8B5CF6' }}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
