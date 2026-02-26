'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Ward {
    id: number;
    code: string;
    name: string;
    deptType: string;
    isActive: boolean;
    opdFieldsConfig: OpdFieldsConfig | null;
}

interface FieldConfig {
    key: string;
    label: string;
    multiplier: number;
}

interface FieldGroup {
    name: string;
    fields: FieldConfig[];
}

interface OpdFieldsConfig {
    groups: FieldGroup[];
    shifts: string[]; // e.g. ['morning'], ['morning','afternoon','night']
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

    // Workload config editor
    const [configWardId, setConfigWardId] = useState<number | null>(null);
    const [configGroups, setConfigGroups] = useState<FieldGroup[]>([]);
    const [configShifts, setConfigShifts] = useState<string[]>(['morning', 'afternoon', 'night']);
    const [savingConfig, setSavingConfig] = useState(false);

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

    // --- Workload Config Editor ---
    const openConfigEditor = (ward: Ward) => {
        setConfigWardId(ward.id);
        if (ward.opdFieldsConfig && ward.opdFieldsConfig.groups) {
            setConfigGroups(JSON.parse(JSON.stringify(ward.opdFieldsConfig.groups)));
            setConfigShifts(ward.opdFieldsConfig.shifts || ['morning', 'afternoon', 'night']);
        } else {
            setConfigGroups([{ name: 'ประเภทผู้ป่วย', fields: [{ key: 'field1', label: '', multiplier: 1.0 }] }]);
            setConfigShifts(['morning', 'afternoon', 'night']);
        }
    };

    const closeConfigEditor = () => {
        setConfigWardId(null);
        setConfigGroups([]);
        setConfigShifts(['morning', 'afternoon', 'night']);
    };

    const addGroup = () => {
        setConfigGroups([...configGroups, { name: '', fields: [{ key: `field_${Date.now()}`, label: '', multiplier: 1.0 }] }]);
    };

    const removeGroup = (gi: number) => {
        setConfigGroups(configGroups.filter((_, i) => i !== gi));
    };

    const updateGroupName = (gi: number, name: string) => {
        const updated = [...configGroups];
        updated[gi] = { ...updated[gi], name };
        setConfigGroups(updated);
    };

    const addField = (gi: number) => {
        const updated = [...configGroups];
        updated[gi] = {
            ...updated[gi],
            fields: [...updated[gi].fields, { key: `field_${Date.now()}`, label: '', multiplier: 1.0 }]
        };
        setConfigGroups(updated);
    };

    const removeField = (gi: number, fi: number) => {
        const updated = [...configGroups];
        updated[gi] = {
            ...updated[gi],
            fields: updated[gi].fields.filter((_, i) => i !== fi)
        };
        setConfigGroups(updated);
    };

    const moveFieldUp = (gi: number, fi: number) => {
        if (fi === 0) return;
        const updated = [...configGroups];
        const fields = [...updated[gi].fields];
        const temp = fields[fi];
        fields[fi] = fields[fi - 1];
        fields[fi - 1] = temp;
        updated[gi] = { ...updated[gi], fields };
        setConfigGroups(updated);
    };

    const moveFieldDown = (gi: number, fi: number) => {
        const updated = [...configGroups];
        const fields = [...updated[gi].fields];
        if (fi === fields.length - 1) return;
        const temp = fields[fi];
        fields[fi] = fields[fi + 1];
        fields[fi + 1] = temp;
        updated[gi] = { ...updated[gi], fields };
        setConfigGroups(updated);
    };

    const updateField = (gi: number, fi: number, field: Partial<FieldConfig>) => {
        const updated = [...configGroups];
        const newFields = [...updated[gi].fields];
        newFields[fi] = { ...newFields[fi], ...field };
        // Auto-generate key from label if label changed
        if (field.label !== undefined) {
            newFields[fi].key = field.label.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '_').replace(/_+/g, '_') || `field_${fi}`;
        }
        updated[gi] = { ...updated[gi], fields: newFields };
        setConfigGroups(updated);
    };

    const saveConfig = async () => {
        if (!configWardId) return;

        // Validate
        for (const g of configGroups) {
            if (!g.name.trim()) {
                setMessage({ type: 'error', text: 'กรุณากรอกชื่อกลุ่มทุกกลุ่ม' });
                return;
            }
            for (const f of g.fields) {
                if (!f.label.trim()) {
                    setMessage({ type: 'error', text: `กลุ่ม "${g.name}": กรุณากรอกชื่อ field ทุกช่อง` });
                    return;
                }
            }
        }

        setSavingConfig(true);
        try {
            const config: OpdFieldsConfig = { groups: configGroups, shifts: configShifts };
            const res = await fetch(`/api/wards/${configWardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ opdFieldsConfig: config }),
            });
            if (!res.ok) throw new Error('Failed to save config');
            setMessage({ type: 'success', text: '✅ บันทึกการตั้งค่า Workload สำเร็จ!' });
            closeConfigEditor();
            await loadWards();
        } catch (err: any) {
            setMessage({ type: 'error', text: `❌ ${err.message}` });
        } finally {
            setSavingConfig(false);
        }
    };

    const ipdWards = wards.filter(w => w.deptType === 'IPD');
    const opdWards = wards.filter(w => w.deptType === 'OPD');

    const configWard = configWardId ? wards.find(w => w.id === configWardId) : null;

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
                        {w.deptType === 'OPD' && w.opdFieldsConfig && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                                ✓ ตั้งค่าแล้ว
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {w.deptType === 'OPD' && (
                            <button onClick={() => openConfigEditor(w)}
                                className="px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg text-xs font-bold hover:bg-teal-100 transition-colors flex items-center gap-1">
                                <i className="fa-solid fa-sliders"></i> Workload
                            </button>
                        )}
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

            {/* Workload Config Editor Modal */}
            {configWard && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-teal-600 to-emerald-500 p-4 flex items-center justify-between text-white">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <i className="fa-solid fa-sliders"></i> ตั้งค่า Workload
                                </h3>
                                <p className="text-sm opacity-90">{configWard.name}</p>
                            </div>
                            <button onClick={closeConfigEditor} className="hover:bg-white/20 rounded-lg w-8 h-8 flex items-center justify-center transition-colors">
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>

                        <div className="p-5 max-h-[70vh] overflow-y-auto">
                            <p className="text-xs text-gray-500 mb-4">
                                กำหนดกลุ่มและรายการ workload สำหรับหน่วยงานนี้ ระบบจะใช้ค่าตัวคูณในการคำนวณ Workload Score
                            </p>

                            {/* Shift Selection */}
                            <div className="mb-5 border-2 border-gray-100 rounded-xl p-4">
                                <p className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1">
                                    <i className="fa-solid fa-clock"></i> เวรที่ใช้งาน
                                </p>
                                <div className="flex gap-4">
                                    {[
                                        { key: 'morning', label: '☀️ เช้า' },
                                        { key: 'afternoon', label: '🌤️ บ่าย' },
                                        { key: 'night', label: '🌙 ดึก' },
                                    ].map(s => (
                                        <label key={s.key} className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={configShifts.includes(s.key)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setConfigShifts([...configShifts, s.key]);
                                                    } else {
                                                        if (configShifts.length <= 1) return; // at least 1
                                                        setConfigShifts(configShifts.filter(x => x !== s.key));
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                            />
                                            <span className="text-sm font-semibold text-gray-700">{s.label}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2">ติ๊กเฉพาะเวรที่หน่วยงานนี้ใช้งาน (ต้องเลือกอย่างน้อย 1 เวร)</p>
                            </div>

                            {configGroups.map((group, gi) => (
                                <div key={gi} className="mb-5 border-2 border-gray-100 rounded-xl overflow-hidden">
                                    {/* Group Header */}
                                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="text-xs font-bold text-gray-400 w-16">กลุ่ม {gi + 1}:</span>
                                            <input
                                                type="text"
                                                value={group.name}
                                                onChange={(e) => updateGroupName(gi, e.target.value)}
                                                placeholder="ชื่อกลุ่ม เช่น ประเภทผู้ป่วย"
                                                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-teal-400"
                                            />
                                        </div>
                                        <button onClick={() => removeGroup(gi)}
                                            className="text-red-400 hover:text-red-600 transition-colors p-1"
                                            title="ลบกลุ่ม">
                                            <i className="fa-solid fa-trash-can text-sm"></i>
                                        </button>
                                    </div>

                                    {/* Fields */}
                                    <div className="p-4 space-y-2">
                                        {/* Header row */}
                                        <div className="grid grid-cols-12 gap-2 mb-1">
                                            <div className="col-span-6 text-[10px] font-bold text-gray-400 uppercase px-1">ชื่อรายการ</div>
                                            <div className="col-span-3 text-[10px] font-bold text-gray-400 uppercase px-1 text-center">ตัวคูณ (×)</div>
                                            <div className="col-span-3"></div>
                                        </div>

                                        {group.fields.map((field, fi) => (
                                            <div key={fi} className="grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-6">
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={(e) => updateField(gi, fi, { label: e.target.value })}
                                                        placeholder="เช่น Level 1, คลอด, GA"
                                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-teal-400"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        value={field.multiplier}
                                                        onChange={(e) => updateField(gi, fi, { multiplier: parseFloat(e.target.value) || 0 })}
                                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-bold focus:outline-none focus:border-teal-400"
                                                    />
                                                </div>
                                                <div className="col-span-3 flex items-center justify-end gap-1">
                                                    <span className="text-[10px] text-gray-400 font-mono truncate mr-2">
                                                        ×{field.multiplier}
                                                    </span>
                                                    <div className="flex bg-gray-100 rounded-lg overflow-hidden">
                                                        <button onClick={() => moveFieldUp(gi, fi)}
                                                            disabled={fi === 0}
                                                            className="px-2 py-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                                            title="เลื่อนขึ้น">
                                                            <i className="fa-solid fa-chevron-up text-[10px]"></i>
                                                        </button>
                                                        <button onClick={() => moveFieldDown(gi, fi)}
                                                            disabled={fi === group.fields.length - 1}
                                                            className="px-2 py-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent border-l border-gray-200 transition-colors"
                                                            title="เลื่อนลง">
                                                            <i className="fa-solid fa-chevron-down text-[10px]"></i>
                                                        </button>
                                                    </div>
                                                    <button onClick={() => removeField(gi, fi)}
                                                        disabled={group.fields.length <= 1}
                                                        className="text-red-400 hover:text-red-600 disabled:opacity-30 transition-colors p-1 ml-1"
                                                        title="ลบรายการ">
                                                        <i className="fa-solid fa-trash-can gap-1 text-sm"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        <button onClick={() => addField(gi)}
                                            className="text-teal-600 text-xs font-bold hover:text-teal-700 transition-colors flex items-center gap-1 mt-2">
                                            <i className="fa-solid fa-plus"></i> เพิ่มรายการ
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Add Group */}
                            <button onClick={addGroup}
                                className="w-full border-2 border-dashed border-gray-300 text-gray-400 hover:border-teal-400 hover:text-teal-600 rounded-xl py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 mb-5">
                                <i className="fa-solid fa-folder-plus"></i> เพิ่มกลุ่มใหม่
                            </button>

                            {/* Save */}
                            <div className="flex items-center justify-end gap-3">
                                <button onClick={closeConfigEditor}
                                    className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors">
                                    ยกเลิก
                                </button>
                                <button onClick={saveConfig} disabled={savingConfig}
                                    className="bg-gradient-to-r from-teal-600 to-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm disabled:opacity-70">
                                    {savingConfig ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                                    {savingConfig ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
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
