'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();

    // The user explicitly requested:
    // "ในส่วนของ Dashboard กับ กรอกข้อมูล ipd / opd ไม่ควรมีเมนู"
    // Exclude sidebar navigation and mobile top bar on Dashboard (/, /dashboard) and Input pages (/input/*)
    const isNoMenuPage = pathname === '/' || pathname === '/dashboard' || pathname.startsWith('/input');

    if (isNoMenuPage) {
        return (
            <main className="min-h-screen w-full transition-all duration-300">
                {children}
            </main>
        );
    }

    return (
        <div className="flex min-h-screen">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 lg:ml-[260px] min-h-screen relative">
                {/* Mobile top bar with hamburger */}
                <div className="lg:hidden sticky top-0 z-30 mobile-topbar px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-95"
                        aria-label="เปิดเมนู"
                    >
                        <i className="fa-solid fa-bars text-sm"></i>
                    </button>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center shadow-md">
                            <i className="fa-solid fa-user-nurse text-white text-xs"></i>
                        </div>
                        <div>
                            <span className="font-bold text-gray-800 text-sm block leading-tight">Nursing Dashboard</span>
                            <span className="text-[10px] text-gray-400">Settings &amp; Management</span>
                        </div>
                    </div>
                </div>

                <main className="transition-all duration-300">
                    {children}
                </main>
            </div>
        </div>
    );
}
