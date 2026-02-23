// ========================================
// Chart.js Configuration - Redesigned
// ========================================

Chart.defaults.font.family = "'Prompt', sans-serif";
Chart.defaults.plugins.legend.display = false;

// Color palette matching mockup
const colors = {
    // OPD Performance
    served: '#14B8A6',
    waiting: '#FBBF24',
    cancelled: '#EF4444',
    
    // Staff Ratio
    fulltime: '#6366F1',
    parttime: '#14B8A6',
    contract: '#FBBF24',
    
    // RN Ratio
    rn: '#6366F1',
    pn: '#FBBF24',
    
    // CAP
    suitable: '#22C55E',
    standard: '#3B82F6',
    skill: '#FBBF24',
    
    // Flow Chart
    flowLine: '#14B8A6',
    flowFill: 'rgba(20, 184, 166, 0.1)'
};

let charts = {};

// ========================================
// IPD Ratio Chart
// ========================================
function createIPDRatioChart(rnPercent = 68, pnPercent = 32) {
    const ctx = document.getElementById('ipd-ratio-chart');
    if (!ctx) return;
    
    if (charts.ipdRatio) charts.ipdRatio.destroy();
    
    charts.ipdRatio = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['RN', 'PN'],
            datasets: [{
                data: [rnPercent, pnPercent],
                backgroundColor: [colors.rn, colors.pn],
                borderWidth: 0,
                cutout: '65%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.raw}%`
                    }
                }
            }
        }
    });
}

// ========================================
// OPD Ratio Chart
// ========================================
function createOPDRatioChart() {
    const ctx = document.getElementById('opd-ratio-chart');
    if (!ctx) return;
    
    if (charts.opdRatio) charts.opdRatio.destroy();
    
    charts.opdRatio = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Full-time', 'Part-time', 'Contract'],
            datasets: [{
                data: [55, 30, 15],
                backgroundColor: [colors.fulltime, colors.parttime, colors.contract],
                borderWidth: 0,
                cutout: '65%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.raw}%`
                    }
                }
            }
        }
    });
}

// ========================================
// IPD CAP Chart
// ========================================
function createIPDCapChart() {
    const ctx = document.getElementById('ipd-cap-chart');
    if (!ctx) return;
    
    if (charts.ipdCap) charts.ipdCap.destroy();
    
    charts.ipdCap = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['17 ผู้ป่วยหนัก', '18 อายุรกรรม', '10 ศัลยกรรม', '6 EENT', '4 ออร์โธปิดิกส์'],
            datasets: [
                {
                    label: 'Suitable',
                    data: [70, 65, 55, 50, 45],
                    backgroundColor: colors.suitable
                },
                {
                    label: 'Standard',
                    data: [20, 25, 30, 35, 40],
                    backgroundColor: colors.standard
                },
                {
                    label: 'Skill Gap',
                    data: [10, 10, 15, 15, 15],
                    backgroundColor: colors.skill
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    max: 100,
                    grid: { display: true, color: 'rgba(0,0,0,0.05)' },
                    ticks: { callback: (v) => v + '%' }
                },
                y: {
                    stacked: true,
                    grid: { display: false }
                }
            }
        }
    });
}

// ========================================
// OPD Performance Chart
// ========================================
function createOPDPerformanceChart() {
    const ctx = document.getElementById('opd-performance-chart');
    if (!ctx) return;
    
    if (charts.opdPerformance) charts.opdPerformance.destroy();
    
    charts.opdPerformance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Emergency (ฉุกเฉิน)', 'Clinic (คลินิก)', 'Pharmacy (เภสัช)', 'Registration (ลงทะเบียน)'],
            datasets: [
                {
                    label: 'Served',
                    data: [65, 75, 69, 65],
                    backgroundColor: colors.served
                },
                {
                    label: 'Waiting',
                    data: [25, 15, 23, 25],
                    backgroundColor: colors.waiting
                },
                {
                    label: 'Cancelled',
                    data: [10, 10, 8, 10],
                    backgroundColor: colors.cancelled
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    max: 100,
                    grid: { display: true, color: 'rgba(0,0,0,0.05)' },
                    ticks: { 
                        callback: (v) => v + '%',
                        stepSize: 10
                    }
                },
                y: {
                    stacked: true,
                    grid: { display: false }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%`
                    }
                }
            }
        }
    });
}

// ========================================
// Patient Flow Chart
// ========================================
function createPatientFlowChart() {
    const ctx = document.getElementById('patient-flow-chart');
    if (!ctx) return;
    
    if (charts.patientFlow) charts.patientFlow.destroy();
    
    // Generate sample data for patient flow
    const labels = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];
    const data = [150, 450, 780, 920, 650, 820, 750];
    
    charts.patientFlow = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Patient Flow',
                data: data,
                borderColor: colors.flowLine,
                backgroundColor: colors.flowFill,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: colors.flowLine,
                pointHoverBorderColor: 'white',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: 1000,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { stepSize: 250 }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (ctx) => `Patients: ${ctx.raw}`
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
    
    // Add peak hours annotation
    addPeakLabel();
}

function addPeakLabel() {
    // This would add a "Peak Hours" label on the chart
    // For simplicity, we'll handle this in CSS/HTML
}

// ========================================
// Initialize All Charts
// ========================================
function initializeCharts() {
    createIPDRatioChart();
    createOPDRatioChart();
    createIPDCapChart();
    createOPDPerformanceChart();
    createPatientFlowChart();
}

// ========================================
// Update Functions
// ========================================
function updateIPDCharts(data) {
    if (data.productivity) {
        updateProductivityRing('ipd', data.productivity);
        const display = document.getElementById('ipd-productivity-display');
        if (display) display.textContent = data.productivity.toFixed(2) + '%';
    }
    if (data.workforce) {
        document.getElementById('ipd-workforce').textContent = formatNumber(data.workforce);
    }
    if (data.nightShift) {
        document.getElementById('ipd-night-shift').textContent = formatNumber(data.nightShift);
    }
}

function updateOPDCharts(data) {
    if (data.productivity) {
        updateProductivityRing('opd', data.productivity);
        const display = document.getElementById('opd-productivity-display');
        if (display) display.textContent = data.productivity.toFixed(2) + '%';
    }
    if (data.workforce) {
        document.getElementById('opd-workforce').textContent = formatNumber(data.workforce);
    }
    if (data.morningShift) {
        document.getElementById('opd-morning-shift').textContent = formatNumber(data.morningShift);
    }
}

function updateProductivityRing(type, value) {
    const ring = document.getElementById(`${type}-ring`);
    const valueEl = document.getElementById(`${type}-productivity-value`);
    
    if (valueEl) {
        valueEl.textContent = value.toFixed(2);
    }
    
    if (ring) {
        // 327 is the circumference, calculate offset
        const offset = 327 * (1 - value / 100);
        ring.style.strokeDashoffset = offset;
    }
}

function formatNumber(num) {
    return new Intl.NumberFormat('th-TH').format(num);
}

// Export for main.js
window.chartFunctions = {
    initializeCharts,
    updateIPDCharts,
    updateOPDCharts,
    createIPDCapChart,
    createOPDPerformanceChart,
    createPatientFlowChart
};
