import Papa from 'papaparse';

export interface SheetRow {
    [key: string]: any;
}

export function parseCSV(csvText: string): SheetRow[] {
    const results = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().replace(/"/g, '').toLowerCase(),
        transform: (v) => v.trim().replace(/"/g, ''),
    });
    
    // Normalize headers and convert types
    return results.data.map((row: any) => {
        const newRow: any = {};
        Object.keys(row).forEach(key => {
            const normalizedKey = normalizeHeaderName(key);
            let value = row[key];
            // Convert to number if possible, but keep leading zeros if it looks like ID? 
            // Actually for this dashboard, most numbers are metrics.
            if (!isNaN(Number(value)) && value !== '') {
                value = Number(value);
            }
            newRow[normalizedKey] = value;
        });
        return newRow;
    });
}

function normalizeHeaderName(header: string): string {
    const h = header.toLowerCase().trim();
    
    // Date column
    if (h === 'date' || h === 'วันที่' || h === 'วัน') return 'date';
    
    // Department type
    if (h === 'dept_type' || h === 'department' || h === 'dept' || h === 'type' || h === 'ประเภท' || h === 'แผนก') return 'dept_type';
    
    // Productivity
    if (h === 'productivity' || h === 'prod' || h === 'ผลิตภาพ') return 'productivity';
    
    // Ward Name
    if (h === 'ward_name' || h === 'ward' || h === 'unit' || h === 'หอผู้ป่วย' || h === 'หน่วยงาน') return 'ward_name';
    
    // Total Nurses / Workforce
    if (h === 'total_nurses' || h === 'total_workforce' || h === 'total' || h === 'จำนวนพยาบาล' || h === 'กำลังคน') return 'total_workforce';
    
    // RN Count
    if (h === 'rn_count' || h === 'rn' || h === 'พยาบาลวิชาชีพ') return 'rn_count';
    
    // PN Count
    if (h === 'pn_count' || h === 'pn' || h === 'na' || h === 'pn_na' || h === 'ผู้ช่วย' || h === 'ผู้ช่วยพยาบาล') return 'pn_count';
    
    // Shifts
    if (h === 'night_shift_nurses' || h === 'night' || h === 'เวรดึก') return 'night_shift_nurses';
    if (h === 'morning_shift_nurses' || h === 'morning' || h === 'เวรเช้า') return 'morning_shift_nurses';
    if (h === 'afternoon_shift_nurses' || h === 'afternoon' || h === 'เวรบ่าย') return 'afternoon_shift_nurses';
    
    // Scores
    if (h === 'target_score' || h === 'target' || h === 'เป้าหมาย') return 'target_score';
    if (h === 'actual_score' || h === 'actual' || h === 'คะแนนจริง') return 'actual_score';
    
    // CMI / Patient Visit
    if (h === 'cmi') return 'cmi';
    if (h === 'patient_visit' || h === 'visit' || h === 'ผู้ป่วย' || h === 'จำนวนผู้ป่วย') return 'patient_visit';
    
    // CAP
    if (h === 'cap_suitable' || h === 'suitable' || h === 'เหมาะสม') return 'cap_suitable';
    if (h === 'cap_improve' || h === 'improve' || h === 'ปรับปรุง') return 'cap_improve';
    if (h === 'cap_shortage' || h === 'shortage' || h === 'ขาดแคลน') return 'cap_shortage';
    
    return h;
}

export function convertToCSVUrl(url: string, gid: string = '0'): string {
    if (url.includes('/export?format=csv') || url.includes('/pub?output=csv')) {
        return url;
    }
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
        return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
    }
    return url;
}

export function normalizeDate(dateStr: string): string {
    if (!dateStr) return '';
    const s = String(dateStr).trim();
    
    // If already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    
    // Split by / or -
    const parts = s.split(/[\/-]/);
    if (parts.length === 3) {
        const [p1, p2, p3] = parts;
        
        // Check if p3 is year (4 digits) - format is either M/D/Y or D/M/Y
        if (p3.length === 4) {
            const v1 = parseInt(p1);
            const v2 = parseInt(p2);
            
            // If v1 > 12, then v1 must be Day, v2 is Month (D/M/Y format)
            if (v1 > 12) {
                return `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
            }
            
            // If v2 > 12, then v2 must be Day, v1 is Month (M/D/Y format)
            if (v2 > 12) {
                return `${p3}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
            }
            
            // Ambiguous case (both <= 12): Default to M/D/Y (Google Sheets US format)
            // e.g., 1/2/2026 -> 2026-01-02 (Jan 2)
            return `${p3}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
        }
        
        // Check if p1 is year (4 digits) - format Y-M-D
        if (p1.length === 4) {
            return `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
        }
    }
    
    return s;
}

export function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
