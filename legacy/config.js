// =============================================
// Nursing Dashboard Configuration
// =============================================
// แก้ไขไฟล์นี้เพื่อตั้งค่า Google Sheets URL
// URL จะถูกโหลดอัตโนมัติเมื่อเปิด Dashboard
// =============================================

const CONFIG = {
    // Google Sheets URL (Published as CSV)
    // วิธีได้ URL: File -> Share -> Publish to web -> CSV
    googleSheetsUrl: "",
    
    // Auto-connect เมื่อโหลดหน้า
    autoConnect: true,
    
    // Default department
    defaultDepartment: "IPD",
    
    // Refresh interval (milliseconds) - 0 = ไม่ auto refresh
    refreshInterval: 0
};

// Export for use in main script
if (typeof module !== 'undefined') {
    module.exports = CONFIG;
}
