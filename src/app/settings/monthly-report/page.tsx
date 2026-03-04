'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

type MonthlyData = {
  id: number;
  name: string;
  deptType: string;
  // IPD
  patientDaySum: number;
  newAdmissionSum: number;
  dischargeSum: number;
  avgHppd: string;
  avgCmi: string;
  avgIpdProductivity: string;
  // OPD
  patientTotalSum: number;
  avgOpdWorkload: string;
};

export default function MonthlyReportPage() {
  // State
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    // default to current month
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [filterDept, setFilterDept] = useState<'All' | 'IPD' | 'OPD'>('All');

  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/monthly?month=${month}&deptType=${filterDept}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      // Filter out wards that have 0 for all major stats depending on dept
      const filteredData = result.data.filter((w: MonthlyData) => {
        if (filterDept === 'IPD' && w.patientDaySum === 0 && w.newAdmissionSum === 0) return false;
        if (filterDept === 'OPD' && w.patientTotalSum === 0) return false;
        return true;
      });

      setData(filteredData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [month, filterDept]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatMonthDisplay = (yyyyMm: string) => {
    if (!yyyyMm) return '';
    const [y, m] = yyyyMm.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-gray-400 hover:text-indigo-600 transition-colors">
            <i className="fa-solid fa-arrow-left text-lg"></i>
          </Link>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 w-12 h-12 flex justify-center items-center rounded-xl shadow-lg text-white">
            <i className="fa-solid fa-chart-column text-2xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">รายงานสรุปประจำเดือน</h1>
            <p className="text-xs text-gray-500">ข้อมูลรวมและค่าเฉลี่ยรายเดือนของแต่ละหน่วยงาน</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-xl px-4 py-2 border-2 border-indigo-100 shadow-sm focus-within:border-indigo-500 transition-colors">
            <i className="fa-solid fa-layer-group text-indigo-500 mr-2"></i>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value as any)}
              className="text-sm font-bold text-gray-700 bg-transparent outline-none cursor-pointer"
            >
              <option value="All">ทุกแผนก (All)</option>
              <option value="IPD">เฉพาะ IPD</option>
              <option value="OPD">เฉพาะ OPD</option>
            </select>
          </div>

          <div className="flex items-center bg-white rounded-xl px-4 py-2 border-2 border-indigo-100 shadow-sm relative group focus-within:border-indigo-500 transition-colors">
            <label className="text-xs text-gray-500 mr-2 font-semibold">เดือน:</label>
            <div className="relative flex items-center w-[120px]">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full h-full bg-transparent outline-none cursor-pointer date-input-full-picker text-transparent"
              />
              <div className="absolute inset-0 flex justify-between items-center text-sm font-bold text-indigo-700 pointer-events-none">
                <span>{month ? `${month.split('-')[1]}/${month.split('-')[0]}` : ''}</span>
                <i className="fa-regular fa-calendar-days text-indigo-400 group-hover:text-indigo-600 transition-colors"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-gray-900 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <i className="fa-solid fa-table-list text-indigo-400"></i> สรุปข้อมูลเดือน {formatMonthDisplay(month)}
            </h2>
          </div>
          {data.length > 0 && !loading && (
            <div className="text-xs font-semibold bg-white/20 px-3 py-1.5 rounded-lg inline-flex items-center gap-2 w-fit">
              <i className="fa-solid fa-check-circle text-emerald-400"></i> แสดง {data.length} หน่วยงาน
            </div>
          )}
        </div>

        <div className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
              <i className="fa-solid fa-circle-notch fa-spin text-4xl mb-3"></i>
              <p className="font-semibold animate-pulse">กำลังประมวลผลข้อมูลประจำเดือน...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-red-500 bg-red-50">
              <i className="fa-solid fa-circle-exclamation text-4xl mb-3"></i>
              <p className="font-bold">{error}</p>
              <button onClick={fetchReport} className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 transition-colors">
                ลาดข้อมูลใหม่
              </button>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50">
              <i className="fa-solid fa-folder-open text-5xl mb-3 text-gray-300"></i>
              <p className="font-bold text-lg text-gray-500">ไม่พบข้อมูลในเดือนนี้</p>
              <p className="text-sm">ยังไม่มีการบันทึกข้อมูลของหน่วยงานใดๆ ในระบบ</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b-2 border-gray-100">
                <tr>
                  <th className="px-5 py-4 rounded-tl-xl sticky left-0 bg-gray-50 outline outline-1 outline-gray-100 z-10 w-[200px]">หน่วยงาน</th>

                  {(filterDept === 'All' || filterDept === 'IPD') && (
                    <>
                      <th className="px-4 py-4 text-center border-l border-gray-200 bg-indigo-50/50">ยอดผู้ป่วยรวม (Pt Day)</th>
                      <th className="px-4 py-4 text-center bg-indigo-50/50">รับใหม่ (New Admit)</th>
                      <th className="px-4 py-4 text-center bg-indigo-50/50">จำหน่าย (D/C)</th>
                      <th className="px-4 py-4 text-center bg-indigo-50/50" title="ค่าเฉลี่ย HPPD">Avg HPPD</th>
                      <th className="px-4 py-4 text-center bg-indigo-50/50" title="ค่าเฉลี่ย CMI">Avg CMI</th>
                      <th className="px-4 py-4 text-center font-bold text-indigo-700 bg-indigo-100">IPD Product. (%)</th>
                    </>
                  )}

                  {(filterDept === 'All' || filterDept === 'OPD') && (
                    <>
                      <th className="px-4 py-4 text-center border-l border-gray-200 bg-orange-50/50">ปริมาณผู้ป่วยรวม (Visit)</th>
                      <th className="px-4 py-4 text-center font-bold text-orange-700 bg-orange-100">OPD Product. (%)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row) => {
                  const isIpd = row.deptType === 'IPD' || row.deptType === 'BOTH';
                  const isOpd = row.deptType === 'OPD' || row.deptType === 'ER' || row.deptType === 'LR' || row.deptType === 'BOTH';

                  // Parse productivity for coloring (assuming 85-115 is normal, <85 under, >115 over)
                  const ipdProd = parseFloat(row.avgIpdProductivity);
                  let ipdColor = "text-gray-500";
                  if (ipdProd > 0) {
                    ipdColor = ipdProd > 115 ? "text-red-600 bg-red-50" : ipdProd < 85 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50";
                  }

                  const opdProd = parseFloat(row.avgOpdWorkload);
                  let opdColor = "text-gray-500";
                  if (opdProd > 0) {
                    opdColor = opdProd > 115 ? "text-red-600 bg-red-50" : opdProd < 85 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50";
                  }

                  return (
                    <tr key={row.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-5 py-3 font-bold text-gray-700 sticky left-0 bg-white group-hover:bg-blue-50/30 outline outline-1 outline-gray-50 z-10">
                        {row.name}
                        <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{row.deptType}</span>
                      </td>

                      {(filterDept === 'All' || filterDept === 'IPD') && (
                        <>
                          <td className="px-4 py-3 text-center border-l border-gray-100">{isIpd && row.patientDaySum > 0 ? row.patientDaySum.toLocaleString() : '-'}</td>
                          <td className="px-4 py-3 text-center">{isIpd && row.newAdmissionSum > 0 ? row.newAdmissionSum.toLocaleString() : '-'}</td>
                          <td className="px-4 py-3 text-center">{isIpd && row.dischargeSum > 0 ? row.dischargeSum.toLocaleString() : '-'}</td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-600">{isIpd && parseFloat(row.avgHppd) > 0 ? row.avgHppd : '-'}</td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-600">{isIpd && parseFloat(row.avgCmi) > 0 ? row.avgCmi : '-'}</td>
                          <td className={`px-4 py-3 text-center font-bold ${ipdColor} rounded-md m-1`}>
                            {isIpd && ipdProd > 0 ? `${row.avgIpdProductivity}%` : '-'}
                          </td>
                        </>
                      )}

                      {(filterDept === 'All' || filterDept === 'OPD') && (
                        <>
                          <td className="px-4 py-3 text-center border-l border-gray-100">{isOpd && row.patientTotalSum > 0 ? row.patientTotalSum.toLocaleString() : '-'}</td>
                          <td className={`px-4 py-3 text-center font-bold ${opdColor} rounded-md m-1`}>
                            {isOpd && opdProd > 0 ? `${row.avgOpdWorkload}%` : '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Legend */}
      {data.length > 0 && !loading && (
        <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-gray-500"><div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div> &gt; 115% (ภาระงานสูง)</div>
          <div className="flex items-center gap-1.5 text-gray-500"><div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></div> 85% - 115% (ภาระงานเหมาะสม)</div>
          <div className="flex items-center gap-1.5 text-gray-500"><div className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></div> &lt; 85% (ภาระงานน้อย)</div>
        </div>
      )}
    </div>
  );
}
