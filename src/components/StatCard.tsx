import React from 'react';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle: string;
    icon: string;
    colorClass: string; // e.g. text-indigo-600
    bgClass: string; // e.g. bg-indigo-100
    badgeText?: string;
}

export default function StatCard({ title, value, subtitle, icon, colorClass, bgClass, badgeText }: StatCardProps) {
    return (
        <div className="card-kpi p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className={`${bgClass} p-4 rounded-xl`}>
                    <i className={`${icon} text-2xl ${colorClass}`}></i>
                </div>
                <div>
                    <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
                    <div className={`text-3xl font-bold ${colorClass}`}>{value}</div>
                </div>
            </div>
            {badgeText && (
                <div className={`stat-badge ${bgClass} ${colorClass.replace('text-', 'text-dark-')}`}>
                    <i className={`${icon} mr-1`}></i>{badgeText}
                </div>
            )}
        </div>
    );
}
