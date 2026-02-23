// ========================================
// Nursing Dashboard Main Application
// Redesigned Version
// ========================================

// ========================================
// Tab Switching
// ========================================
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-content`).classList.add('active');
    
    // Reinitialize charts when switching tabs
    setTimeout(() => {
        if (tabName === 'ipd') {
            window.chartFunctions.createIPDCapChart();
        } else {
            window.chartFunctions.createOPDPerformanceChart();
            window.chartFunctions.createPatientFlowChart();
        }
    }, 100);
}

// ========================================
// Google Sheets Integration
// ========================================
async function connectSheets() {
    const urlInput = document.getElementById('sheets-url');
    const statusDiv = document.getElementById('sheets-status');
    const url = urlInput.value.trim();
    
    if (!url) {
        showStatus('error', '❌ กรุณาใส่ URL ของ Google Sheets');
        return;
    }
    
    showStatus('loading', '⏳ กำลังเชื่อมต่อ...');
    
    try {
        const csvUrl = convertToCSVUrl(url);
        const response = await fetch(csvUrl);
        
        if (!response.ok) {
            throw new Error('ไม่สามารถเข้าถึง Google Sheets ได้');
        }
        
        const csvData = await response.text();
        const jsonData = parseCSV(csvData);
        
        processSheetData(jsonData);
        showStatus('success', '✅ เชื่อมต่อสำเร็จ! โหลดข้อมูลแล้ว');
        localStorage.setItem('sheetsUrl', url);
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('error', `❌ ${error.message}`);
    }
}

function convertToCSVUrl(url) {
    if (url.includes('/export?format=csv') || url.includes('/pub?output=csv')) {
        return url;
    }
    
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
        const spreadsheetId = match[1];
        const gidMatch = url.match(/gid=(\d+)/);
        const gid = gidMatch ? gidMatch[1] : '0';
        return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
    }
    
    return url;
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        const values = parseCSVLine(lines[i]);
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] ? values[index].trim().replace(/"/g, '') : '';
        });
        
        data.push(row);
    }
    
    return data;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

function showStatus(type, message) {
    const statusDiv = document.getElementById('sheets-status');
    statusDiv.className = `sheets-status ${type}`;
    
    const icons = {
        loading: '⏳',
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    statusDiv.innerHTML = `<span class="status-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
}

// ========================================
// Process Sheet Data
// ========================================
function processSheetData(data) {
    const ipdData = data.filter(row => row.department_type?.toUpperCase() === 'IPD');
    const opdData = data.filter(row => row.department_type?.toUpperCase() === 'OPD');
    
    if (ipdData.length > 0) {
        const ipdStats = calculateStats(ipdData, 'IPD');
        window.chartFunctions.updateIPDCharts(ipdStats);
    }
    
    if (opdData.length > 0) {
        const opdStats = calculateStats(opdData, 'OPD');
        window.chartFunctions.updateOPDCharts(opdStats);
    }
}

function calculateStats(data, type) {
    const stats = {};
    
    let totalNurses = 0;
    let totalRN = 0;
    let totalPN = 0;
    let totalNightShift = 0;
    let totalMorningShift = 0;
    let totalTargetScore = 0;
    let totalActualScore = 0;
    
    data.forEach(row => {
        totalNurses += parseInt(row.total_nurses) || 0;
        totalRN += parseInt(row.rn_count) || 0;
        totalPN += parseInt(row.pn_count) || 0;
        totalNightShift += parseInt(row.night_shift_nurses) || 0;
        totalMorningShift += parseInt(row.morning_shift_nurses) || 0;
        totalTargetScore += parseFloat(row.target_score) || 0;
        totalActualScore += parseFloat(row.actual_score) || 0;
    });
    
    const productivity = totalTargetScore > 0 ? (totalActualScore / totalTargetScore) * 100 : 0;
    
    stats.productivity = productivity;
    stats.workforce = totalNurses;
    
    if (type === 'IPD') {
        stats.nightShift = totalNightShift;
    } else {
        stats.morningShift = totalMorningShift;
    }
    
    return stats;
}

// ========================================
// Load Data
// ========================================
function loadData() {
    const savedUrl = localStorage.getItem('sheetsUrl');
    if (savedUrl) {
        document.getElementById('sheets-url').value = savedUrl;
        connectSheets();
    } else {
        loadDemoData();
    }
}

function loadDemoData() {
    // Initialize charts with demo data
    window.chartFunctions.initializeCharts();
    
    // Set initial productivity values
    updateProductivity('ipd', 86.97);
    updateProductivity('opd', 82.45);
}

function updateProductivity(type, value) {
    const ring = document.getElementById(`${type}-ring`);
    const valueEl = document.getElementById(`${type}-productivity-value`);
    const displayEl = document.getElementById(`${type}-productivity-display`);
    
    if (valueEl) {
        valueEl.textContent = value.toFixed(2);
    }
    
    if (displayEl) {
        displayEl.textContent = value.toFixed(2) + '%';
    }
    
    if (ring) {
        const offset = 327 * (1 - value / 100);
        ring.style.strokeDashoffset = offset;
    }
}

// ========================================
// Initialize
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    // Load data
    loadData();
    
    console.log('📊 Nurse Dashboard Initialized');
    console.log('💡 Dashboard ready at http://localhost:3000');
});

// Global functions
window.switchTab = switchTab;
window.loadData = loadData;
window.connectSheets = connectSheets;
