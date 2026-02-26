import React from 'react';

interface HeroCardProps {
    title: string;
    value: string | number;
    subtitle: string;
    icon: string;
    gradient: string;
    target?: string;
    belowTarget?: boolean;
}

export default function HeroCard({ title, value, subtitle, icon, gradient, target, belowTarget }: HeroCardProps) {
    return (
        <div className="relative overflow-hidden rounded-2xl p-6 text-center text-white shadow-xl" 
             style={{ background: gradient }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
            <div className="relative z-10">
                <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <i className={`${icon} text-xl`}></i>
                    </div>
                    <h3 className="text-white/90 text-sm font-bold uppercase tracking-wider">{title}</h3>
                </div>
                <div className={`text-5xl font-extrabold mb-2 drop-shadow-lg ${belowTarget ? 'text-red-300' : ''}`}>
                    {value}
                </div>
                {belowTarget && (
                    <div className="inline-flex items-center gap-1 bg-red-500/30 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold mb-2">
                        <i className="fa-solid fa-triangle-exclamation"></i> ต่ำกว่าเป้า
                    </div>
                )}
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-semibold">
                    <i className="fa-solid fa-bullseye"></i>
                    <span>{subtitle} {target && `: ${target}`}</span>
                </div>
            </div>
        </div>
    );
}
