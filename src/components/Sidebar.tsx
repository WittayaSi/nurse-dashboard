'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
    href: string;
    icon: string;
    label: string;
}

interface NavGroup {
    label: string | null;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        label: null,
        items: [
            { href: '/', icon: 'fa-solid fa-chart-pie', label: 'Dashboard' },
        ],
    },
    {
        label: 'บันทึกข้อมูล',
        items: [
            { href: '/input/ipd', icon: 'fa-solid fa-bed', label: 'IPD (ผู้ป่วยใน)' },
            { href: '/input/opd', icon: 'fa-solid fa-truck-medical', label: 'OPD (ผู้ป่วยนอก)' },
        ],
    },
    {
        label: 'รายงาน & วิเคราะห์',
        items: [
            { href: '/settings/monthly-report', icon: 'fa-solid fa-chart-column', label: 'สรุปประจำเดือน' },
            { href: '/settings/trends', icon: 'fa-solid fa-chart-line', label: 'วิเคราะห์แนวโน้ม' },
            { href: '/settings/missing-data', icon: 'fa-solid fa-circle-exclamation', label: 'ข้อมูลที่ขาด' },
        ],
    },
    {
        label: 'ส่งออกข้อมูล',
        items: [
            { href: '/export/ipd', icon: 'fa-solid fa-file-excel', label: 'Export IPD' },
            { href: '/export/opd', icon: 'fa-solid fa-file-arrow-down', label: 'Export OPD' },
        ],
    },
    {
        label: 'ตั้งค่า',
        items: [
            { href: '/settings', icon: 'fa-solid fa-sliders', label: 'ศูนย์จัดการ' },
            { href: '/settings/wards', icon: 'fa-solid fa-hospital', label: 'หน่วยงาน / Ward' },
        ],
    },
];

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === '/' || href === '/settings') return pathname === href;
        return pathname === href || pathname.startsWith(href + '/');
    };

    return (
        <>
            {/* Mobile backdrop */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sidebar */}
            <aside
                className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
                role="navigation"
                aria-label="เมนูหลัก"
            >
                {/* Brand */}
                <div className="px-5 pt-6 pb-5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                            <i className="fa-solid fa-user-nurse text-white text-lg"></i>
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-white font-bold text-sm tracking-tight truncate">Nursing Organization</h1>
                            <p className="text-white/40 text-[11px]">Workforce Dashboard</p>
                        </div>
                        {/* Mobile close button */}
                        <button
                            onClick={onClose}
                            className="lg:hidden ml-auto w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors shrink-0"
                            aria-label="ปิดเมนู"
                        >
                            <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 sidebar-nav">
                    {navGroups.map((group, gi) => (
                        <div key={gi} className={gi > 0 ? 'mt-6' : ''}>
                            {group.label && (
                                <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 select-none">
                                    {group.label}
                                </div>
                            )}
                            <div className="flex flex-col gap-0.5">
                                {group.items.map((item) => {
                                    const active = isActive(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={onClose}
                                            className={`sidebar-item ${active ? 'sidebar-item-active' : ''}`}
                                        >
                                            <i className={`${item.icon} w-5 text-center text-[13px]`}></i>
                                            <span className="text-[13px]">{item.label}</span>
                                            {active && <div className="sidebar-active-dot" />}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-white/[0.06]">
                    <div className="flex items-center gap-2 text-white/25">
                        <i className="fa-solid fa-shield-halved text-[10px]"></i>
                        <p className="text-[10px] tracking-wide">Nursing Dashboard v1.0</p>
                    </div>
                </div>
            </aside>
        </>
    );
}
