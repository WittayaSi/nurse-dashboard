'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function MissingDataPage() {
  // Missing Data State
  const [date, setDate] = useState<string>(() => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    return yest.toISOString().split('T')[0];
  });
  const [missingData, setMissingData] = useState<{
    missingIpd: { id: number; name: string }[];
    missingOpd: { id: number; name: string }[];
    totalMissing: number;
  } | null>(null);
  const [loadingMissing, setLoadingMissing] = useState(false);

  useEffect(() => {
    setLoadingMissing(true);
    fetch(`/api/missing-data?date=${date}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) setMissingData(data);
      })
      .catch(err => console.error('Failed to fetch missing data:', err))
      .finally(() => setLoadingMissing(false));
  }, [date]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100 p-4 md:p-6">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/settings" className="text-gray-400 hover:text-indigo-600 transition-colors">
          <i className="fa-solid fa-arrow-left text-lg"></i>
        </Link>
        <div className="bg-gradient-to-r from-red-500 to-orange-500 w-12 h-12 flex justify-center items-center rounded-xl shadow-lg text-white">
          <i className="fa-solid fa-bell text-2xl"></i>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">สอดส่องการบันทึกข้อมูล</h1>
          <p className="text-xs text-gray-500">ตรวจสอบหน่วยงานที่ยังไม่ส่งข้อมูลกำลังคน</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <i className="fa-solid fa-bell text-xl animate-pulse"></i>
            <h2 className="font-bold text-lg">ข้อมูลประจำวันที่ (Missing Data)</h2>
          </div>
          <div className="flex items-center bg-white rounded-xl px-4 py-2 shadow-sm relative group transition-all text-gray-700">
            <i className="fa-regular fa-calendar text-orange-500 mr-2 group-hover:text-red-500 transition-colors pointer-events-none hidden sm:inline-block"></i>
            <label className="text-xs text-gray-500 mr-2 pointer-events-none whitespace-nowrap hidden sm:inline-block">วันที่:</label>
            <div className="relative flex items-center w-[100px] sm:w-[130px]">
              {/* The actual native input is the single source of truth for clicks */}
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                onKeyDown={(e) => e.preventDefault()}
                className="w-full h-full bg-transparent outline-none cursor-pointer date-input-full-picker text-transparent"
                aria-label="วันที่"
              />
              {/* The visual overlay sits on top but is completely transparent to clicks */}
              <div className="absolute inset-0 flex justify-between items-center text-sm font-bold text-gray-800 pointer-events-none px-1 sm:px-2">
                <span>{date ? date.split('-').reverse().join('/') : ''}</span>
                <i className="fa-regular fa-calendar-days text-gray-400 group-hover:text-orange-500 transition-colors"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-8">
          {loadingMissing ? (
            <div className="text-center py-12 text-gray-400">
              <i className="fa-solid fa-spinner fa-spin text-3xl"></i>
              <p className="text-sm mt-3">กำลังตรวจสอบข้อมูล...</p>
            </div>
          ) : missingData ? (
            missingData.totalMissing === 0 ? (
              <div className="text-center py-12 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-check text-4xl"></i>
                </div>
                <h3 className="text-emerald-800 font-bold text-2xl mb-2">ยอดเยี่ยมมาก!</h3>
                <p className="text-emerald-600 font-medium">ทุกหน่วยงานบันทึกข้อมูลประจำวันที่ {date.split('-').reverse().join('/')} เรียบร้อยแล้ว</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* IPD Missing */}
                <div className="bg-red-50 border border-red-100 rounded-2xl p-5 md:p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 text-red-700 font-bold pb-3 border-b border-red-200 text-lg">
                    <div className="bg-red-100 p-2 rounded-lg"><i className="fa-solid fa-bed"></i></div>
                    ผู้ป่วยใน (IPD)
                    <span className="ml-auto bg-red-600 text-white text-xs px-2.5 py-1 rounded-full shadow-sm">
                      {missingData.missingIpd.length} หน่วยงาน
                    </span>
                  </div>
                  {missingData.missingIpd.length > 0 ? (
                    <ul className="space-y-3">
                      {missingData.missingIpd.map(w => (
                        <li key={w.id} className="text-base font-semibold text-red-900 bg-white px-4 py-3 rounded-xl border border-red-100 shadow-sm flex items-center gap-3 transition-transform hover:-translate-y-0.5">
                          <i className="fa-solid fa-circle-exclamation text-red-500 text-lg"></i> {w.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-base text-emerald-600 font-medium flex items-center gap-2 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100">
                      <i className="fa-solid fa-check-circle text-lg"></i> ครบถ้วนแล้ว
                    </div>
                  )}
                </div>

                {/* OPD Missing */}
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 md:p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 text-orange-700 font-bold pb-3 border-b border-orange-200 text-lg">
                    <div className="bg-orange-100 p-2 rounded-lg"><i className="fa-solid fa-truck-medical"></i></div>
                    ผู้ป่วยนอก (OPD)
                    <span className="ml-auto bg-orange-500 text-white text-xs px-2.5 py-1 rounded-full shadow-sm">
                      {missingData.missingOpd.length} หน่วยงาน
                    </span>
                  </div>
                  {missingData.missingOpd.length > 0 ? (
                    <ul className="space-y-3">
                      {missingData.missingOpd.map(w => (
                        <li key={w.id} className="text-base font-semibold text-orange-900 bg-white px-4 py-3 rounded-xl border border-orange-100 shadow-sm flex items-center gap-3 transition-transform hover:-translate-y-0.5">
                          <i className="fa-solid fa-circle-exclamation text-orange-500 text-lg"></i> {w.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-base text-emerald-600 font-medium flex items-center gap-2 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100">
                      <i className="fa-solid fa-check-circle text-lg"></i> ครบถ้วนแล้ว
                    </div>
                  )}
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
