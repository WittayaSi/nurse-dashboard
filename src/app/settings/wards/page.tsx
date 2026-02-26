'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Ward {
    id: number;
    code: string;
    name: string;
    deptType: string;
    isActive: boolean;
}

export default function WardSettingsPage() {
    const [wards, setWards] = useState<Ward[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Add form
    const [showForm, setShowForm] = useState(false);
    const [formDept, setFormDept] = useState<'IPD' | 'OPD'>('IPD');
    const [newName, setNewName] = useState('');

    // Edit mode
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    const loadWards = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/wards');
            const data = await res.json();
            setWards(data);
        } catch (err) {
            console.error('Error loading wards:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadWards(); }, []);

    // Auto-gen code: IPD-01, IPD-02, ... / OPD-01, OPD-02, ...
    const generateCode = (dept: 'IPD' | 'OPD') => {
        const existing = wards.filter(w => w.code.startsWith(dept + '-'));
        const maxNum = existing.reduce((max, w) => {
            const num = parseInt(w.code.replace(dept + '-', ''));
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        return `${dept}-${String(maxNum + 1).padStart(2, '0')}`;
    };

    const handleAdd = async () => {
        if (!newName.trim()) {
            setMessage({ type: 'error', text: 'กรุณากรอกชื่อ' });
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/wards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: generateCode(formDept), name: newName.trim(), deptType: formDept }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create');
            }
            setNewName('');
            setShowForm(false);
            setMessage({ type: 'success', text: '✅ เพิ่มสำเร็จ!' });
            await loadWards();
        } catch (err: any) {
            setMessage({ type: 'error', text: `❌ ${err.message}` });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (id: number) => {
        if (!editName.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/wards/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim() }),
            });
            if (!res.ok) throw new Error('Failed to update');
            setEditId(null);
            setMessage({ type: 'success', text: '✅ อัพเดทสำเร็จ!' });
            await loadWards();
        } catch (err: any) {
            setMessage({ type: 'error', text: `❌ ${err.message}` });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`ต้องการลบ "${name}" หรือไม่?`)) return;
        try {
            const res = await fetch(`/api/wards/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            setMessage({ type: 'success', text: '✅ ลบสำเร็จ!' });
            await loadWards();
        } catch (err: any) {
            setMessage({ type: 'error', text: `❌ ${err.message}` });
        }
    };

    const ipdWards = wards.filter(w => w.deptType === 'IPD');
    const opdWards = wards.filter(w => w.deptType === 'OPD');

    const WardRow = ({ w }: { w: Ward }) => (
        <div className="card-kpi p-4 flex items-center justify-between">
            {editId === w.id ? (
                <div className="flex-1 flex gap-2 items-center">
                    <span className="text-xs font-mono bg-gray-100 text-gray-400 px-2 py-1 rounded">{w.code}</span>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-3 py-1.5 border-2 border-indigo-300 rounded-lg text-sm font-semibold focus:outline-none"
                        autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUpdate(w.id)}
                    />
                    <button onClick={() => handleUpdate(w.id)} disabled={saving}
                        className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600">
                        <i className="fa-solid fa-check"></i>
                    </button>
                    <button onClick={() => setEditId(null)}
                        className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-300">
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-1 rounded">{w.code}</span>
                        <span className="font-bold text-gray-800">{w.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => { setEditId(w.id); setEditName(w.name); }}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors">
                            <i className="fa-solid fa-pen"></i>
                        </button>
                        <button onClick={() => handleDelete(w.id, w.name)}
                            className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">
                            <i className="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100 p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Link href="/" className="text-gray-400 hover:text-indigo-600 transition-colors">
                        <i className="fa-solid fa-arrow-left text-lg"></i>
                    </Link>
                    <div className="bg-gradient-to-r from-gray-700 to-gray-900 p-3 rounded-xl shadow-lg text-white">
                        <i className="fa-solid fa-gear text-xl"></i>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">ตั้งค่าหน่วยงาน</h1>
                        <p className="text-xs text-gray-500">จัดการ Nursing Wards</p>
                    </div>
                </div>
                <button
                    onClick={() => { setShowForm(!showForm); setNewName(''); }}
                    className="gradient-header text-white px-4 py-2 rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm"
                >
                    <i className={`fa-solid ${showForm ? 'fa-times' : 'fa-plus'}`}></i>
                    {showForm ? 'ปิด' : 'เพิ่มหน่วยงาน'}
                </button>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {/* Add Form */}
            {showForm && (
                <div className="card-kpi p-5 mb-6">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-plus-circle text-indigo-500"></i> เพิ่มหน่วยงานใหม่
                    </h3>

                    {/* Step 1: เลือก IPD / OPD */}
                    <div className="mb-4">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">1. เลือกประเภท</label>
                        <select value={formDept} onChange={(e) => setFormDept(e.target.value as 'IPD' | 'OPD')}
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-sm font-semibold"
                        >
                            <option value="IPD">🏥 IPD (ผู้ป่วยใน)</option>
                            <option value="OPD">🚑 OPD (ผู้ป่วยนอก)</option>
                        </select>
                    </div>

                    {/* Step 2: กรอกชื่อ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">
                                2. {formDept === 'IPD' ? 'ชื่อหอผู้ป่วย' : 'ชื่อแผนก'}
                            </label>
                            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                                placeholder={formDept === 'IPD' ? 'เช่น 18 อายุรกรรม' : 'เช่น ห้องฉุกเฉิน (ER)'}
                                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-sm font-semibold"
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-gray-400">รหัส (อัตโนมัติ)</span>
                            <div className="flex gap-2 items-center">
                                <span className="px-3 py-2 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-sm font-mono text-gray-500">
                                    {generateCode(formDept)}
                                </span>
                                <button onClick={handleAdd} disabled={saving}
                                    className="gradient-header text-white px-5 py-2 rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm disabled:opacity-70 whitespace-nowrap"
                                >
                                    {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                                    เพิ่ม
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="text-center py-12 text-gray-400">
                    <i className="fa-solid fa-spinner fa-spin text-3xl mb-3"></i>
                    <p>กำลังโหลด...</p>
                </div>
            ) : (
                <>
                    {/* IPD */}
                    <div className="mb-6">
                        <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm">
                            🏥 IPD (ผู้ป่วยใน)
                            <span className="bg-indigo-100 text-indigo-600 text-xs px-2 py-0.5 rounded-lg font-bold">{ipdWards.length}</span>
                        </h2>
                        {ipdWards.length === 0 ? (
                            <div className="card-kpi p-4 text-center text-gray-400 text-sm">ยังไม่มี — กดปุ่ม "เพิ่มหน่วยงาน"</div>
                        ) : (
                            <div className="space-y-2">{ipdWards.map(w => <WardRow key={w.id} w={w} />)}</div>
                        )}
                    </div>

                    {/* OPD */}
                    <div className="mb-6">
                        <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm">
                            🚑 OPD (ผู้ป่วยนอก)
                            <span className="bg-rose-100 text-rose-600 text-xs px-2 py-0.5 rounded-lg font-bold">{opdWards.length}</span>
                        </h2>
                        {opdWards.length === 0 ? (
                            <div className="card-kpi p-4 text-center text-gray-400 text-sm">ยังไม่มี — กดปุ่ม "เพิ่มหน่วยงาน" แล้วเลือก OPD</div>
                        ) : (
                            <div className="space-y-2">{opdWards.map(w => <WardRow key={w.id} w={w} />)}</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
