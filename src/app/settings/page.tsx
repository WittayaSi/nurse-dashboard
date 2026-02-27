'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
    const [ipdCount, setIpdCount] = useState<number | null>(null);
    const [opdCount, setOpdCount] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/wards?deptType=IPD').then(r => r.json()).then(d => setIpdCount(d.length)).catch(() => setIpdCount(0));
        fetch('/api/wards?deptType=OPD').then(r => r.json()).then(d => setOpdCount(d.length)).catch(() => setOpdCount(0));
    }, []);

    const loading = ipdCount === null || opdCount === null;

    const menuItems = [
        {
            href: '/settings/wards',
            icon: 'fa-solid fa-hospital',
            title: 'ตั้งค่าหน่วยงาน',
            desc: 'เพิ่ม / แก้ไข / ลบ Ward และแผนก (ต้องตั้งค่าก่อนกรอกข้อมูล)',
            gradient: 'from-gray-700 to-gray-900',
            bg: 'bg-gray-50',
            disabled: false,
            badge: null as string | null,
        },
        {
            href: '/input/ipd',
            icon: 'fa-solid fa-bed',
            title: 'กรอกข้อมูล IPD',
            desc: 'บันทึกกำลังคนผู้ป่วยใน รายเวร',
            gradient: 'from-indigo-600 to-blue-500',
            bg: 'bg-indigo-50',
            disabled: ipdCount === 0,
            badge: ipdCount === 0 ? 'ยังไม่มี Ward IPD — กรุณาตั้งค่าหน่วยงานก่อน' : null,
        },
        {
            href: '/input/opd',
            icon: 'fa-solid fa-truck-medical',
            title: 'กรอกข้อมูล OPD',
            desc: 'บันทึกข้อมูลผู้ป่วยนอก ER / LR',
            gradient: 'from-rose-600 to-orange-500',
            bg: 'bg-rose-50',
            disabled: opdCount === 0,
            badge: opdCount === 0 ? 'ยังไม่มี Ward OPD — กรุณาตั้งค่าหน่วยงานก่อน' : null,
        },
        {
            href: '/export/ipd',
            icon: 'fa-solid fa-file-excel',
            title: 'Export ข้อมูล IPD',
            desc: 'ดาวน์โหลดรายงานกำลังคน IPD เป็นไฟล์ Excel',
            gradient: 'from-emerald-600 to-teal-500',
            bg: 'bg-emerald-50',
            disabled: ipdCount === 0,
            badge: ipdCount === 0 ? 'ยังไม่มี Ward IPD — ไม่สามารถ Export ได้' : null,
        },
        {
            href: '/export/opd',
            icon: 'fa-solid fa-file-arrow-down',
            title: 'Export ข้อมูล OPD',
            desc: 'ดาวน์โหลดรายงานกำลังคน OPD เป็นไฟล์ Excel',
            gradient: 'from-fuchsia-600 to-pink-500',
            bg: 'bg-fuchsia-50',
            disabled: opdCount === 0,
            badge: opdCount === 0 ? 'ยังไม่มี Ward OPD — ไม่สามารถ Export ได้' : null,
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100 p-4 md:p-6">
            <div className="flex items-center gap-3 mb-8">
                <Link href="/" className="text-gray-400 hover:text-indigo-600 transition-colors">
                    <i className="fa-solid fa-arrow-left text-lg"></i>
                </Link>
                <div className="bg-gradient-to-r from-gray-700 to-gray-900 w-12 h-12 flex justify-center items-center rounded-xl shadow-lg text-white">
                    <i className="fa-solid fa-sliders text-2xl"></i>
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-800">ตั้งค่า & จัดการข้อมูล</h1>
                    <p className="text-xs text-gray-500">กรอกข้อมูล, จัดการหน่วยงาน</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">
                    <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {menuItems.map(item => {
                        const content = (
                            <div className={`${item.bg} rounded-2xl p-6 border border-gray-100 shadow-sm transition-all group relative
                                ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-1'}`}
                            >
                                <div className={`w-12 h-12 bg-gradient-to-r ${item.gradient} rounded-xl flex items-center justify-center text-white mb-4 shadow-md ${!item.disabled ? 'group-hover:scale-110' : ''} transition-transform`}>
                                    <i className={`${item.icon} text-lg`}></i>
                                </div>
                                <h3 className="font-bold text-gray-800 mb-1">{item.title}</h3>
                                <p className="text-xs text-gray-500">{item.desc}</p>
                                {item.badge && (
                                    <div className="mt-4 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg flex items-start gap-1.5 leading-tight">
                                        <i className="fa-solid fa-triangle-exclamation mt-0.5"></i> {item.badge}
                                    </div>
                                )}
                                {!item.disabled && (
                                    <div className="mt-3 text-xs font-semibold text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        เปิด <i className="fa-solid fa-arrow-right text-[10px]"></i>
                                    </div>
                                )}
                            </div>
                        );

                        return item.disabled ? (
                            <div key={item.href}>{content}</div>
                        ) : (
                            <Link key={item.href} href={item.href}>{content}</Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
