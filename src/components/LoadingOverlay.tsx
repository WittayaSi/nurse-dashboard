import React from 'react';

interface LoadingOverlayProps {
    isLoading: boolean;
    message?: string;
}

export default function LoadingOverlay({ isLoading, message = 'กรุณารอสักครู่...' }: LoadingOverlayProps) {
    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center transition-opacity duration-300">
            <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-gray-100">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-800">กำลังโหลดข้อมูล...</h3>
                    <p className="text-sm text-gray-500">{message}</p>
                </div>
            </div>
        </div>
    );
}
