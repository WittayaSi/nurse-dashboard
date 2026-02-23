'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Header from './Header';
import HeroCard from './HeroCard';
import StatCard from './StatCard';
import WardChart from './Charts/WardChart';
import SkillMixChart from './Charts/SkillMixChart';
import CapStatusChart from './Charts/CapStatusChart';
import SettingsModal, { AppSettings } from './SettingsModal';
import LoadingOverlay from './LoadingOverlay';
import { parseCSV, convertToCSVUrl, SheetRow, normalizeDate } from '@/lib/sheets';

const wardsIPD = [
    "18 อายุรกรรม", "17 ผู้ป่วยหนัก", "10 ศัลยกรรม", "6 EENT", 
    "4 ออร์โธปิดิกส์", "3 กุมาร", "2 สูติ-นรีเวช", "1 ฉุกเฉิน ICU"
];
const wardsOPD = [
    "OPD อายุรกรรม", "OPD ศัลยกรรม", "OPD สูติ-นรีเวช", "OPD เด็ก", 
    "ห้องฉุกเฉิน (ER)", "เภสัชกรรม", "ทันตกรรม", "ลงทะเบียน"
];

interface DashboardData {
    deptType: 'IPD' | 'OPD';
    productivity: number;
    totalWorkforce: number;
    cmi: number;
    patientVisit: number;
    shifts: {
        morning: { rn: number; nonRn: number };
        afternoon: { rn: number; nonRn: number };
        midnight: { rn: number; nonRn: number };
    };
    workforce: { rn: number; nonRn: number };
    skillMix: { total: number; onDuty: number; ratio: string };
    capStatus: { suitable: number; improve: number; shortage: number };
    wardData: { name: string; prod: number }[];
}

const initialData: DashboardData = {
    deptType: 'IPD',
    productivity: 0,
    totalWorkforce: 0,
    cmi: 0,
    patientVisit: 0,
    shifts: {
        morning: { rn: 0, nonRn: 0 },
        afternoon: { rn: 0, nonRn: 0 },
        midnight: { rn: 0, nonRn: 0 }
    },
    workforce: { rn: 0, nonRn: 0 },
    skillMix: { total: 0, onDuty: 0, ratio: '-' },
    capStatus: { suitable: 0, improve: 0, shortage: 0 },
    wardData: []
};

export default function Dashboard() {
    const [dept, setDept] = useState<'IPD' | 'OPD'>('IPD');
    const [ward, setWard] = useState<string>('all');
    const [date, setDate] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
    
    const [settings, setSettings] = useState<AppSettings>({
        mainUrl: '',
        summarySheet: 'Daily_Summary',
        ipdSheet: 'IPD_Workforce',
        opdSheet: 'OPD_Workforce'
    });

    const [data, setData] = useState<DashboardData>(initialData);
    
    // Raw Data
    const [sheetsData, setSheetsData] = useState<SheetRow[] | null>(null);
    const [ipdWorkforceData, setIpdWorkforceData] = useState<SheetRow[] | null>(null);
    const [opdWorkforceData, setOpdWorkforceData] = useState<SheetRow[] | null>(null);

    // Helper function to load settings from JSON file via API
    const loadSettings = useCallback(async (): Promise<AppSettings | null> => {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const settings = await res.json();
                console.log('Loaded settings from settings.json:', settings);
                return settings as AppSettings;
            }
        } catch (error) {
            console.error('Failed to load settings from settings.json:', error);
        }
        return null;
    }, []);

    // Helper function to save settings to JSON file via API
    const saveSettings = useCallback(async (newSettings: AppSettings) => {
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
            if (res.ok) {
                console.log('Saved settings to settings.json:', newSettings);
            }
        } catch (error) {
            console.error('Failed to save settings to settings.json:', error);
        }
    }, []);

    // Initialize
    useEffect(() => {
        const init = async () => {
            const today = new Date().toISOString().split('T')[0];
            setDate(today);
            
            // Load settings from JSON file
            const savedSettings = await loadSettings();
            
            if (savedSettings && savedSettings.mainUrl) {
                console.log('Found saved settings, auto-connecting...');
                setSettings(savedSettings);
                // Auto connect if URL exists
                setTimeout(() => connectAllSheets(savedSettings), 500);
            } else {
                console.log('No saved settings found');
            }
        };
        init();
    }, [loadSettings]);

    // Update data when filters or raw data change
    useEffect(() => {
        calculateDashboardData();
    }, [dept, ward, date, sheetsData, ipdWorkforceData, opdWorkforceData]);

    const connectAllSheets = async (newSettings: AppSettings) => {
        setLoading(true);
        try {
            // Save settings to JSON file
            await saveSettings(newSettings);
            setSettings(newSettings);

            // Resolve GIDs (Simplified: assumes user might paste URL or we use default logic)
            // For now, we'll try to fetch using the provided inputs as is, or resolve if they are names
            // But since we are server-side proxying, we can just try to fetch.
            // However, we need the GID to construct the CSV URL.
            // If the user pasted the full URL into the input, we can extract GID.
            
            // Helper to extract GID or return input if it's a number
            const resolveGid = async (input: string, spreadsheetId: string): Promise<string | null> => {
                console.log(`resolveGid called with input: "${input}", spreadsheetId: "${spreadsheetId}"`);
                
                if (!input) {
                    console.log('resolveGid: Input is empty/null');
                    return null;
                }
                
                // If URL with gid
                const gidMatch = input.match(/gid=(\d+)/);
                if (gidMatch) {
                    console.log(`resolveGid: Found GID in URL: ${gidMatch[1]}`);
                    return gidMatch[1];
                }
                
                // If it's a pure number
                if (/^\d+$/.test(input)) {
                    console.log(`resolveGid: Input is direct GID: ${input}`);
                    return input;
                }
                
                // If it's a sheet name, try to find GID from the spreadsheet
                console.log(`resolveGid: Attempting to resolve sheet name: "${input}"`);
                try {
                    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
                    const res = await fetch(`/api/sheets?url=${encodeURIComponent(url)}`);
                    const html = await res.text();
                    
                    console.log(`resolveGid: Fetched HTML length: ${html.length}`);
                    
                    // Try multiple patterns found in Google Sheets HTML
                    const safeName = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    
                    // Pattern 1: JSON-like structure with name and gid
                    const patterns = [
                        new RegExp(`"name"\\s*:\\s*"${safeName}"[^}]*"gid"\\s*:\\s*"?(\\d+)"?`, 'i'),
                        new RegExp(`"gid"\\s*:\\s*"?(\\d+)"?[^}]*"name"\\s*:\\s*"${safeName}"`, 'i'),
                        new RegExp(`\\[\\d+,"${safeName}",\\d+,\\d+,\\d+,\\d+,\\d+,\\d+,\\d+,(\\d+)`, 'i'),
                        new RegExp(`gid=(\\d+)[^"]*${safeName}`, 'i'),
                        new RegExp(`${safeName}[^"]*gid=(\\d+)`, 'i'),
                    ];
                    
                    for (let i = 0; i < patterns.length; i++) {
                        const match = html.match(patterns[i]);
                        if (match) {
                            console.log(`resolveGid: Pattern ${i + 1} matched, GID: ${match[1]}`);
                            return match[1];
                        }
                    }
                    
                    console.warn(`resolveGid: Could not find GID for sheet name: "${input}". Try pasting the full sheet URL with gid=`);
                } catch (e) {
                    console.error('resolveGid: Failed to resolve GID for', input, e);
                }
                
                return null;
            };

            // Extract Spreadsheet ID
            let spreadsheetId = '';
            const match = newSettings.mainUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (match) spreadsheetId = match[1];
            else throw new Error('Invalid Google Sheets URL');

            let summaryGid = await resolveGid(newSettings.summarySheet, spreadsheetId);
            const ipdGid = await resolveGid(newSettings.ipdSheet, spreadsheetId);
            const opdGid = await resolveGid(newSettings.opdSheet, spreadsheetId);

            // FALLBACK: If summary GID is null, use GID 0 (first sheet)
            if (!summaryGid) {
                console.log('Using fallback GID 0 for Summary sheet');
                summaryGid = '0';
            }

            console.log('Resolved GIDs:', { summaryGid, ipdGid, opdGid });

            // Fetch Data
            const baseUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
            
            const loadSheet = async (gid: string | null) => {
                if (!gid) return [];
                const url = `${baseUrl}&gid=${gid}`;
                const res = await fetch(`/api/sheets?url=${encodeURIComponent(url)}`);
                if (!res.ok) throw new Error(`Failed to load sheet (GID: ${gid})`);
                const csv = await res.text();
                return parseCSV(csv);
            };

            const [summary, ipd, opd] = await Promise.all([
                loadSheet(summaryGid),
                loadSheet(ipdGid),
                loadSheet(opdGid)
            ]);

            setSheetsData(summary);
            setIpdWorkforceData(ipd);
            setOpdWorkforceData(opd);

            // Find the latest date from summary data and set it as default
            if (summary.length > 0) {
                const dates = summary
                    .map(row => normalizeDate(String(row.date)))
                    .filter(d => d) // filter out empty/invalid dates
                    .sort((a, b) => b.localeCompare(a)); // sort descending
                
                if (dates.length > 0) {
                    const latestDate = dates[0];
                    console.log('Setting date to latest available:', latestDate);
                    setDate(latestDate);
                }
            }

            console.log('Loaded Summary Rows:', summary.length, summary[0]);
            console.log('Loaded IPD Rows:', ipd.length, ipd[0]);
            console.log('Loaded OPD Rows:', opd.length, opd[0]);
            
        } catch (error: any) {
            console.error(error);
            alert(`Connection failed: ${error.message}`);
            throw error; // Re-throw for modal to handle
        } finally {
            setLoading(false);
        }
    };

    const calculateDashboardData = () => {
        // Default values
        let result: DashboardData = { ...initialData, deptType: dept };

        // If no data, return empty (but keep dept)
        if (!sheetsData) {
            setData(result);
            return;
        }

        // Filter by Date
        const filteredSummary = sheetsData.filter(row => {
            if (!row.date) return false;
            const rowDate = normalizeDate(String(row.date));
            return rowDate === date;
        });
        
        console.log('=== calculateDashboardData ===');
        console.log('Total rows in sheetsData:', sheetsData.length);
        console.log('Filtering for date:', date);
        console.log('After date filter:', filteredSummary.length, 'rows');
        if (sheetsData.length > 0) {
             console.log('Sample Row:', sheetsData[0]);
             console.log('Sample Row Date:', sheetsData[0].date, 'Normalized:', normalizeDate(String(sheetsData[0].date)));
        }

        // Filter by Dept
        const deptSummary = filteredSummary.filter(row => 
            String(row.dept_type).toUpperCase() === dept
        );
        console.log('Filter for dept:', dept);
        console.log('After dept filter:', deptSummary.length, 'rows');
        if (filteredSummary.length > 0) {
            console.log('Sample row dept_type:', filteredSummary[0].dept_type);
        }

        // Filter by Ward if selected
        let finalSummary = deptSummary;
        if (ward !== 'all') {
            finalSummary = deptSummary.filter(row => String(row.ward_name) === ward);
        }
        console.log('Filter for ward:', ward);
        console.log('After ward filter:', finalSummary.length, 'rows');

        if (finalSummary.length === 0) {
            console.log('No matching data found, returning initial data');
            setData(result);
            return;
        }

        // Calculate Aggregates
        let totalProd = 0;
        let countProd = 0;
        let totalWorkforce = 0;
        let totalRN = 0;
        let totalPN = 0;
        let totalCMI = 0;
        let totalPatientVisit = 0;
        
        // CAP
        let capSuitable = 0;
        let capImprove = 0;
        let capShortage = 0;

        // Shifts (IPD)
        let morningRN = 0, morningPN = 0;
        let afternoonRN = 0, afternoonPN = 0;
        let midnightRN = 0, midnightPN = 0;

        // Process IPD/OPD Workforce Data if available
        if (dept === 'IPD' && ipdWorkforceData) {
            const filteredIPD = ipdWorkforceData.filter(row => {
                if (!row.date) return false;
                return normalizeDate(String(row.date)) === date;
            });
            
            // Filter by Ward if selected
            const finalIPD = ward !== 'all' 
                ? filteredIPD.filter(row => String(row.ward_name) === ward)
                : filteredIPD;

            console.log('IPD data for processing:', finalIPD.length, 'rows');
            
            finalIPD.forEach(row => {
                const shiftType = String(row.shift || '').toLowerCase();
                const rn = parseInt(String(row.rn_count)) || 0;
                const pn = parseInt(String(row.pn_count)) || 0;
                
                // Add to total workforce
                totalRN += rn;
                totalPN += pn;
                totalWorkforce += rn + pn;
                
                // Group by shift
                if (shiftType.includes('morning') || shiftType.includes('เช้า')) {
                    morningRN += rn;
                    morningPN += pn;
                } else if (shiftType.includes('afternoon') || shiftType.includes('บ่าย')) {
                    afternoonRN += rn;
                    afternoonPN += pn;
                } else if (shiftType.includes('night') || shiftType.includes('ดึก') || shiftType.includes('midnight')) {
                    midnightRN += rn;
                    midnightPN += pn;
                }
                
                // CAP Status
                const cap = String(row.cap_status || '').toLowerCase();
                if (cap.includes('suitable') || cap.includes('เหมาะสม')) {
                    capSuitable++;
                } else if (cap.includes('improve') || cap.includes('ปรับปรุง')) {
                    capImprove++;
                } else if (cap.includes('shortage') || cap.includes('ขาดแคลน')) {
                    capShortage++;
                }
            });
            
            console.log('IPD Shifts calculated:', { morningRN, morningPN, afternoonRN, afternoonPN, midnightRN, midnightPN });
        } else if (dept === 'OPD' && opdWorkforceData) {
            const filteredOPD = opdWorkforceData.filter(row => {
                if (!row.date) return false;
                return normalizeDate(String(row.date)) === date;
            });
            
            // Filter by Ward/Unit if selected
            const finalOPD = ward !== 'all' 
                ? filteredOPD.filter(row => String(row.unit_name || row.ward_name) === ward)
                : filteredOPD;
            
            console.log('OPD data for processing:', finalOPD.length, 'rows');
            
            finalOPD.forEach(row => {
                const rn = parseInt(String(row.rn_count)) || 0;
                const pn = parseInt(String(row.pn_count)) || 0;
                
                totalRN += rn;
                totalPN += pn;
                totalWorkforce += rn + pn;
                totalPatientVisit += parseInt(String(row.patient_count)) || 0;
                
                // CAP Status for OPD
                const cap = String(row.cap_status || '').toLowerCase();
                if (cap.includes('suitable') || cap.includes('เหมาะสม')) {
                    capSuitable++;
                } else if (cap.includes('improve') || cap.includes('ปรับปรุง')) {
                    capImprove++;
                } else if (cap.includes('shortage') || cap.includes('ขาดแคลน')) {
                    capShortage++;
                }
            });
            
            console.log('OPD totals calculated:', { totalRN, totalPN, totalWorkforce, totalPatientVisit, capSuitable, capImprove, capShortage });
        }

        // Ward Data for Chart - aggregate from IPD/OPD workforce data
        const wardDataList: { name: string; prod: number }[] = [];
        const wardProdMap: { [key: string]: { total: number; count: number } } = {};
        
        // Build ward productivity from IPD data
        if (dept === 'IPD' && ipdWorkforceData) {
            const filteredIPD = ipdWorkforceData.filter(row => {
                if (!row.date) return false;
                return normalizeDate(String(row.date)) === date;
            });
            
            filteredIPD.forEach(row => {
                const wardName = String(row.ward_name || '');
                const prod = parseFloat(String(row.productivity)) || 0;
                
                if (wardName && prod > 0) {
                    if (!wardProdMap[wardName]) {
                        wardProdMap[wardName] = { total: 0, count: 0 };
                    }
                    wardProdMap[wardName].total += prod;
                    wardProdMap[wardName].count++;
                }
            });
        }
        
        // Build ward productivity from OPD data (using unit_name)
        if (dept === 'OPD' && opdWorkforceData) {
            const filteredOPD = opdWorkforceData.filter(row => {
                if (!row.date) return false;
                return normalizeDate(String(row.date)) === date;
            });
            
            filteredOPD.forEach(row => {
                const unitName = String(row.unit_name || row.ward_name || '');
                const prod = parseFloat(String(row.productivity)) || 0;
                
                if (unitName && prod > 0) {
                    if (!wardProdMap[unitName]) {
                        wardProdMap[unitName] = { total: 0, count: 0 };
                    }
                    wardProdMap[unitName].total += prod;
                    wardProdMap[unitName].count++;
                }
            });
        }
        
        // Convert map to list with average productivity
        Object.entries(wardProdMap).forEach(([name, data]) => {
            const avgProd = data.count > 0 ? data.total / data.count : 0;
            wardDataList.push({ name, prod: parseFloat(avgProd.toFixed(2)) });
        });
        
        // Sort by productivity descending
        wardDataList.sort((a, b) => b.prod - a.prod);
        
        console.log('Ward Performance Data:', wardDataList);

        finalSummary.forEach(row => {
            const prod = parseFloat(String(row.productivity)) || 0;
            if (prod > 0) {
                totalProd += prod;
                countProd++;
            }

            totalWorkforce += parseInt(String(row.total_workforce)) || 0;
            totalRN += parseInt(String(row.rn_count)) || 0;
            totalPN += parseInt(String(String(row.pn_count))) || 0;
            
            if (dept === 'IPD') {
                totalCMI += parseFloat(String(row.cmi)) || 0;
                // Shifts are now calculated from ipdWorkforceData above
                // But if ipdWorkforceData is missing, we might fallback to Summary columns if they exist
                // midnightRN += parseInt(String(row.night_shift_nurses)) || 0; 
                // We'll leave this empty to avoid double counting if we use the block above.
                // Or we can use this as fallback?
                // Let's rely on the block above for shifts.
                // But we still need CMI from Summary.
                totalCMI += parseFloat(String(row.cmi)) || 0;
            } else {
                totalPatientVisit += parseInt(String(row.patient_visit)) || 0;
            }

            // CAP
            const cap = String(row.cap_status || '').toLowerCase(); // Assuming there's a cap_status column or calculated?
            // Legacy used 'cap_suitable', 'cap_improve', 'cap_shortage' columns if available, OR calculated from 'cap_status' string.
            // Let's check `normalizeHeaderName`. It maps `cap_suitable` etc.
            // So we sum them up.
            capSuitable += parseInt(String(row.cap_suitable)) || 0;
            capImprove += parseInt(String(row.cap_improve)) || 0;
            capShortage += parseInt(String(row.cap_shortage)) || 0;

            // Ward Data
            if (row.ward_name) {
                wardDataList.push({
                    name: String(row.ward_name),
                    prod: prod
                });
            }
        });

        // Averages
        const avgProd = countProd > 0 ? (totalProd / countProd) : 0;
        const avgCMI = countProd > 0 ? (totalCMI / countProd) : 0;

        // Skill Mix
        const totalMix = totalRN + totalPN;
        const rnRatio = totalMix > 0 ? ((totalRN / totalMix) * 100).toFixed(1) : '0';
        const ratioDisplay = totalPN > 0 ? `1:${(totalRN/totalPN).toFixed(1)}` : '-';

        // Update Result
        result = {
            deptType: dept,
            productivity: parseFloat(avgProd.toFixed(2)),
            totalWorkforce: totalWorkforce,
            cmi: parseFloat(avgCMI.toFixed(2)),
            patientVisit: totalPatientVisit,
            shifts: {
                morning: { rn: Math.floor(totalRN * 0.4), nonRn: Math.floor(totalPN * 0.4) }, // Mock distribution if data missing
                afternoon: { rn: Math.floor(totalRN * 0.3), nonRn: Math.floor(totalPN * 0.3) },
                midnight: { rn: midnightRN, nonRn: Math.floor(totalPN * 0.2) } // Use actual midnight if available
            },
            workforce: { rn: totalRN, nonRn: totalPN },
            skillMix: {
                total: totalMix,
                onDuty: midnightRN, // Using midnight as proxy for "on duty" or similar
                ratio: `1:${Math.round(totalPN/totalRN) || 1}` // Simplified ratio
            },
            capStatus: {
                suitable: capSuitable,
                improve: capImprove,
                shortage: capShortage
            },
            wardData: wardDataList
        };

        setData(result);
    };

    return (
        <div className="p-4 md:p-6 min-h-screen">
            <LoadingOverlay isLoading={loading} />
            <SettingsModal 
                isOpen={settingsOpen} 
                onClose={() => setSettingsOpen(false)} 
                onConnect={connectAllSheets}
                initialSettings={settings}
            />
            
            <Header 
                dept={dept} setDept={setDept}
                ward={ward} setWard={setWard}
                date={date} setDate={setDate}
                onRefresh={() => calculateDashboardData()}
                onOpenSettings={() => setSettingsOpen(true)}
                wards={dept === 'IPD' ? wardsIPD : wardsOPD}
            />
            
            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: KPIs & Workforce */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    
                    {/* Hero Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <HeroCard 
                            title="Productivity" 
                            value={`${data.productivity}%`} 
                            subtitle="Target" 
                            target="85%"
                            icon="fa-solid fa-chart-line"
                            gradient="linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #2dd4bf 100%)"
                        />
                        {dept === 'IPD' ? (
                            <HeroCard 
                                title="CMI" 
                                value={data.cmi} 
                                subtitle="Case Mix Index" 
                                icon="fa-solid fa-weight-scale"
                                gradient="linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)"
                            />
                        ) : (
                            <HeroCard 
                                title="Patient Visit" 
                                value={data.patientVisit.toLocaleString()} 
                                subtitle="ผู้ป่วยต่อวัน" 
                                icon="fa-solid fa-user-group"
                                gradient="linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)"
                            />
                        )}
                    </div>
                    
                    {/* Workforce Card */}
                    <StatCard 
                        title="Total Workforce" 
                        value={data.totalWorkforce.toLocaleString()} 
                        subtitle="พยาบาลทั้งหมด" 
                        icon="fa-solid fa-users"
                        colorClass="text-indigo-600"
                        bgClass="bg-indigo-100"
                    />
                    
                    {/* Workforce Status Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-gradient-to-b from-pink-500 to-pink-600 rounded-full"></div>
                            <h2 className="font-bold text-gray-800">Workforce Status</h2>
                            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">{dept}</span>
                        </div>
                    </div>

                    {/* IPD Table or OPD Grid */}
                    {dept === 'IPD' ? (
                        <div className="flex flex-col gap-4">
                            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 font-semibold">
                                        <tr>
                                            <th className="px-4 py-3">เวร (Shift)</th>
                                            <th className="px-4 py-3 text-center"><span className="text-pink-600">RN</span></th>
                                            <th className="px-4 py-3 text-center"><span className="text-amber-600">PN/NA</span></th>
                                            <th className="px-4 py-3 text-center">รวม</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr className="hover:bg-orange-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-700">☀️ เช้า</td>
                                            <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.morning.rn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.morning.nonRn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.morning.rn + data.shifts.morning.nonRn}</td>
                                        </tr>
                                        <tr className="hover:bg-blue-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-700">🌤️ บ่าย</td>
                                            <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.afternoon.rn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.afternoon.nonRn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.afternoon.rn + data.shifts.afternoon.nonRn}</td>
                                        </tr>
                                        <tr className="hover:bg-indigo-50/50">
                                            <td className="px-4 py-3 font-semibold text-gray-700">🌙 ดึก</td>
                                            <td className="px-4 py-3 text-center font-bold text-pink-600">{data.shifts.midnight.rn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-amber-600">{data.shifts.midnight.nonRn}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-800 bg-gray-50">{data.shifts.midnight.rn + data.shifts.midnight.nonRn}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Staff Mix Ratio */}
                            <div className="card-kpi p-5 flex items-center justify-between">
                                <div className="flex flex-col gap-2">
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Staff Mix Ratio</div>
                                    <div className="text-3xl font-bold text-pink-600">
                                        {data.skillMix.total > 0 ? ((data.workforce.rn / data.skillMix.total) * 100).toFixed(1) : 0}% RN
                                    </div>
                                    <div className="flex gap-3 text-xs">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-pink-500 rounded-full"></span> RN: <strong>{data.workforce.rn}</strong></span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> PN: <strong>{data.workforce.nonRn}</strong></span>
                                    </div>
                                </div>
                                <div className="w-28 h-28 relative">
                                    <SkillMixChart rn={data.workforce.rn} pn={data.workforce.nonRn} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <StatCard 
                                title="พยาบาล (RN)" 
                                value={data.workforce.rn} 
                                subtitle="คน" 
                                icon="fa-solid fa-user-nurse"
                                colorClass="text-pink-600"
                                bgClass="bg-pink-50"
                            />
                            <StatCard 
                                title="ผู้ช่วย (PN/NA)" 
                                value={data.workforce.nonRn} 
                                subtitle="คน" 
                                icon="fa-solid fa-user-gear"
                                colorClass="text-amber-600"
                                bgClass="bg-amber-50"
                            />
                        </div>
                    )}
                </div>

                {/* Right Column: Charts */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                    {/* CAP Assessment */}
                    <div className="card-kpi p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-gray-800 font-bold flex items-center gap-2">
                                <i className="fa-solid fa-chart-pie text-indigo-500"></i>
                                CAP Assessment Status
                            </h3>
                            <div className="flex gap-4 text-xs">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> เหมาะสม</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> ปรับปรุง</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> ขาดแคลน</span>
                            </div>
                        </div>
                        <div className="h-48 w-full">
                            <CapStatusChart capData={data.capStatus} />
                        </div>
                    </div>

                    {/* Ward Performance */}
                    <div className="card-kpi p-6 flex-grow flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-gray-800 font-bold flex items-center gap-2">
                                    <i className="fa-solid fa-hospital text-teal-500"></i>
                                    <span>{dept === 'IPD' ? 'Ward Performance (IPD)' : 'Unit Performance (OPD)'}</span>
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">เปรียบเทียบ Productivity ตามหอผู้ป่วย/แผนก</p>
                            </div>
                            <div className="flex flex-col gap-1 text-xs">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-indigo-500"></div> <span className="text-gray-500">Over (&gt;100%)</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-emerald-500"></div> <span className="text-gray-500">Appropriate</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-400"></div> <span className="text-gray-500">Under (&lt;85%)</span></div>
                            </div>
                        </div>

                        <div className="relative w-full flex-grow min-h-[350px]">
                            <WardChart wardData={data.wardData} deptType={dept} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
