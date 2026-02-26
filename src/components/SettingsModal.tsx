import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (settings: AppSettings) => void;
    initialSettings: AppSettings;
}

export interface AppSettings {
    mainUrl: string;
    summarySheet: string;
    ipdSheet: string;
    opdSheet: string;
}

export default function SettingsModal({ isOpen, onClose, onConnect, initialSettings }: SettingsModalProps) {
    const [settings, setSettings] = useState<AppSettings>(initialSettings);
    const [status, setStatus] = useState<{ type: 'ready' | 'loading' | 'error' | 'success', message: string }>({ type: 'ready', message: 'Ready to connect' });

    useEffect(() => {
        setSettings(initialSettings);
    }, [initialSettings, isOpen]);

    const handleSave = async () => {
        setStatus({ type: 'loading', message: 'Connecting...' });
        try {
            await onConnect(settings);
            setStatus({ type: 'success', message: 'Connected successfully!' });
            setTimeout(() => {
                onClose();
                setStatus({ type: 'ready', message: 'Ready to connect' });
            }, 1000);
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message || 'Connection failed' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100">
                {/* Header */}
                <div className="gradient-header p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg flex items-center gap-2"><i className="fa-solid fa-gear"></i> Settings</h3>
                    <button onClick={onClose} className="hover:bg-white/20 rounded-lg w-8 h-8 flex items-center justify-center transition-colors">
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>
                
                {/* Content */}
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <i className="fa-solid fa-database text-indigo-600 text-xl"></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">เชื่อมต่อแหล่งข้อมูล</h3>
                            <p className="text-xs text-gray-500">ตั้งค่าการเชื่อมต่อข้อมูล (Share Link)</p>
                        </div>
                    </div>
                    
                    {/* Main URL */}
                    <div className="mb-5">
                        <label className="text-xs font-bold text-gray-700 mb-1 block uppercase tracking-wider">📎 Data Source URL</label>
                        <input 
                            type="text" 
                            value={settings.mainUrl}
                            onChange={(e) => setSettings({ ...settings, mainUrl: e.target.value })}
                            placeholder="https://..." 
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all text-sm"
                        />
                        <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                            <i className="fa-solid fa-circle-info"></i> วาง URL สำหรับเชื่อมต่อข้อมูล
                        </p>
                    </div>
                    
                    {/* Sheet Names */}
                    <div className="mb-5">
                        <label className="text-xs font-bold text-gray-700 mb-2 block uppercase tracking-wider">📄 Sheet Names / GIDs / URL</label>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold w-24 text-gray-500">Daily Summary:</span>
                                <input 
                                    type="text" 
                                    value={settings.summarySheet}
                                    onChange={(e) => setSettings({ ...settings, summarySheet: e.target.value })}
                                    placeholder="Name, GID, or Sheet URL" 
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold w-24 text-gray-500">IPD Workforce:</span>
                                <input 
                                    type="text" 
                                    value={settings.ipdSheet}
                                    onChange={(e) => setSettings({ ...settings, ipdSheet: e.target.value })}
                                    placeholder="Name, GID, or Sheet URL" 
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-pink-400 focus:outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold w-24 text-gray-500">OPD Workforce:</span>
                                <input 
                                    type="text" 
                                    value={settings.opdSheet}
                                    onChange={(e) => setSettings({ ...settings, opdSheet: e.target.value })}
                                    placeholder="Name, GID, or Sheet URL" 
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-6">
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                            <b>Tip:</b> ก๊อปปี้ URL มาวางในช่องได้เลย ระบบจะดึงข้อมูลให้อัตโนมัติ
                        </p>
                    </div>
                    
                    <button 
                        onClick={handleSave} 
                        disabled={status.type === 'loading'}
                        className="gradient-header text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:opacity-95 transition-all flex items-center gap-2 w-full justify-center transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {status.type === 'loading' ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-link"></i>}
                        {status.type === 'loading' ? 'Connecting...' : 'Connect & Save'}
                    </button>
                    
                    <div className={`mt-4 px-4 py-3 rounded-xl text-xs flex items-center justify-center gap-2 border ${
                        status.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 
                        status.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 
                        'bg-gray-50 text-gray-500 border-gray-100'
                    }`}>
                        <i className={`fa-solid ${
                            status.type === 'error' ? 'fa-times-circle' : 
                            status.type === 'success' ? 'fa-check-circle' : 
                            'fa-circle-check'
                        }`}></i>
                        <span>{status.message}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
