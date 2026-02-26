import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ipdDailyShifts, ipdDailySummary, nursingWards } from '@/db/schema';
import { eq, and, asc, gte, lte, inArray } from 'drizzle-orm';
import ExcelJS from 'exceljs';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        const wardIdsParam = searchParams.get('wardIds');

        if (!dateFrom || !dateTo) {
            return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 });
        }

        const wardIdFilter = wardIdsParam
            ? wardIdsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id))
            : [];

        // Fetch IPD wards
        const wardConditions = [eq(nursingWards.deptType, 'IPD'), eq(nursingWards.isActive, true)];
        if (wardIdFilter.length > 0) {
            wardConditions.push(inArray(nursingWards.id, wardIdFilter));
        }
        const wards = await db.select()
            .from(nursingWards)
            .where(and(...wardConditions))
            .orderBy(asc(nursingWards.code));

        if (wards.length === 0) {
            return NextResponse.json({ error: 'ไม่พบ Ward ที่เลือก' }, { status: 404 });
        }

        const wardIds = wards.map(w => w.id);

        // Fetch shifts
        const shifts = await db.select({
            wardId: ipdDailyShifts.wardId,
            recordDate: ipdDailyShifts.recordDate,
            shift: ipdDailyShifts.shift,
            hnCount: ipdDailyShifts.hnCount,
            rnCount: ipdDailyShifts.rnCount,
            tnCount: ipdDailyShifts.tnCount,
            naCount: ipdDailyShifts.naCount,
        })
            .from(ipdDailyShifts)
            .where(and(
                gte(ipdDailyShifts.recordDate, dateFrom),
                lte(ipdDailyShifts.recordDate, dateTo),
                inArray(ipdDailyShifts.wardId, wardIds),
            ))
            .orderBy(ipdDailyShifts.recordDate, ipdDailyShifts.wardId, ipdDailyShifts.shift);

        // Fetch summaries
        const summaries = await db.select({
            wardId: ipdDailySummary.wardId,
            recordDate: ipdDailySummary.recordDate,
            totalStaffDay: ipdDailySummary.totalStaffDay,
            patientDay: ipdDailySummary.patientDay,
            hppd: ipdDailySummary.hppd,
            dischargeCount: ipdDailySummary.dischargeCount,
            newAdmission: ipdDailySummary.newAdmission,
            productivity: ipdDailySummary.productivity,
            cmi: ipdDailySummary.cmi,
            capStatus: ipdDailySummary.capStatus,
        })
            .from(ipdDailySummary)
            .where(and(
                gte(ipdDailySummary.recordDate, dateFrom),
                lte(ipdDailySummary.recordDate, dateTo),
                inArray(ipdDailySummary.wardId, wardIds),
            ))
            .orderBy(ipdDailySummary.recordDate, ipdDailySummary.wardId);

        // Group by ward
        const shiftsByWard: Record<number, Record<string, Record<string, any>>> = {};
        for (const s of shifts) {
            if (!shiftsByWard[s.wardId]) shiftsByWard[s.wardId] = {};
            if (!shiftsByWard[s.wardId][s.recordDate]) shiftsByWard[s.wardId][s.recordDate] = {};
            shiftsByWard[s.wardId][s.recordDate][s.shift] = s;
        }

        const summaryByWard: Record<number, Record<string, any>> = {};
        for (const s of summaries) {
            if (!summaryByWard[s.wardId]) summaryByWard[s.wardId] = {};
            summaryByWard[s.wardId][s.recordDate] = s;
        }

        // All dates in range
        const allDates: string[] = [];
        const startDate = new Date(dateFrom);
        const endDate = new Date(dateTo);
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            allDates.push(d.toISOString().split('T')[0]);
        }

        // Format dates
        const thaiDateFrom = new Date(dateFrom).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        const thaiDateTo = new Date(dateTo).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

        // --- Styles ---
        const borderThin: Partial<ExcelJS.Borders> = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' },
        };
        const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
        const boldWhiteFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };

        const staffHeaderFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
        const summaryHeaderFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
        const staffFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        const summaryFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        const dayHeaderFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

        const shiftLabelMap: Record<string, string> = { morning: 'ช', afternoon: 'บ', night: 'ด' };
        const activeShifts = ['morning', 'afternoon', 'night'];
        const capLabel: Record<string, string> = { suitable: 'เหมาะสม', improve: 'ปรับปรุง', shortage: 'ขาดแคลน' };

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Nursing Dashboard';
        workbook.created = new Date();

        // One sheet per ward
        for (const ward of wards) {
            const sheetName = ward.name.length > 31 ? ward.name.substring(0, 31) : ward.name;
            const ws = workbook.addWorksheet(sheetName);

            // Columns: วันที่ | เวร | HN | RN | TN | NA | รวม | Pt/Day | HPPD | D/C | รับใหม่ | Productivity | CMI | CAP
            const totalCols = 14;
            ws.columns = [
                { width: 8 },   // วันที่
                { width: 5 },   // เวร
                { width: 7 },   // HN
                { width: 7 },   // RN
                { width: 7 },   // TN
                { width: 7 },   // NA
                { width: 8 },   // รวม
                { width: 9 },   // Pt/Day
                { width: 8 },   // HPPD
                { width: 7 },   // D/C
                { width: 8 },   // รับใหม่
                { width: 11 },  // Productivity
                { width: 7 },   // CMI
                { width: 10 },  // CAP
            ];

            // Row 1: Title
            ws.mergeCells(1, 1, 1, totalCols);
            const titleCell = ws.getCell(1, 1);
            titleCell.value = `${ward.name}   ${thaiDateFrom} — ${thaiDateTo}`;
            titleCell.font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(1).height = 28;

            // Row 2: Section headers
            ws.mergeCells(2, 1, 2, 7);
            const staffHeader = ws.getCell(2, 1);
            staffHeader.value = 'จำนวนเวร / กำลังคน';
            staffHeader.font = boldWhiteFont;
            staffHeader.fill = staffHeaderFill;
            staffHeader.alignment = centerAlign;
            staffHeader.border = borderThin;

            ws.mergeCells(2, 8, 2, totalCols);
            const sumHeader = ws.getCell(2, 8);
            sumHeader.value = 'สรุปรายวัน';
            sumHeader.font = boldWhiteFont;
            sumHeader.fill = summaryHeaderFill;
            sumHeader.alignment = centerAlign;
            sumHeader.border = borderThin;

            ws.getRow(2).height = 22;

            // Row 3: Sub-headers
            const subHeaders = ['วันที่', 'เวร', 'HN', 'RN', 'TN', 'NA', 'รวม', 'Pt/Day', 'HPPD', 'D/C', 'รับใหม่', 'Productivity\n%', 'CMI', 'CAP'];
            const row3 = ws.getRow(3);
            subHeaders.forEach((header, i) => {
                const cell = row3.getCell(i + 1);
                cell.value = header;
                cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
                cell.alignment = centerAlign;
                cell.border = borderThin;
                cell.fill = i < 7 ? staffHeaderFill : summaryHeaderFill;
            });
            row3.height = 28;

            // Data rows
            let rowNum = 4;
            let dayNum = 0;

            for (const dateStr of allDates) {
                dayNum++;
                const dateShifts = shiftsByWard[ward.id]?.[dateStr] || {};
                const daySummary = summaryByWard[ward.id]?.[dateStr] || {};
                const dayStartRow = rowNum;

                for (const shiftKey of activeShifts) {
                    const s = dateShifts[shiftKey];
                    const hn = s?.hnCount || 0;
                    const rn = s?.rnCount || 0;
                    const tn = s?.tnCount || 0;
                    const na = s?.naCount || 0;
                    const total = hn + rn + tn + na;

                    const rowData: any[] = [
                        '',
                        shiftLabelMap[shiftKey],
                        hn || '', rn || '', tn || '', na || '',
                        total || '',
                        '', '', '', '', '', '', '',
                    ];

                    const dataRow = ws.getRow(rowNum);
                    rowData.forEach((val, i) => {
                        const cell = dataRow.getCell(i + 1);
                        cell.value = val;
                        cell.alignment = centerAlign;
                        cell.border = borderThin;
                        cell.font = { size: 10 };
                        if (i >= 2 && i < 7) cell.fill = staffFill;
                        else if (i >= 7) cell.fill = summaryFill;
                    });

                    rowNum++;
                }

                // Fill summary columns on the first shift row of this day (merge across 3 rows)
                const ptDay = daySummary.patientDay || 0;
                const hppd = parseFloat(daySummary.hppd) || 0;
                const dc = daySummary.dischargeCount || 0;
                const newAdm = daySummary.newAdmission || 0;
                const prod = parseFloat(daySummary.productivity) || 0;
                const cmi = parseFloat(daySummary.cmi) || 0;
                const cap = daySummary.capStatus || '';

                // Merge summary columns across the 3 shift rows
                const summaryData = [
                    { col: 8, val: ptDay || '' },
                    { col: 9, val: hppd || '' },
                    { col: 10, val: dc || '' },
                    { col: 11, val: newAdm || '' },
                    { col: 12, val: prod ? `${prod}%` : '' },
                    { col: 13, val: cmi || '' },
                    { col: 14, val: capLabel[cap] || cap || '' },
                ];

                for (const sd of summaryData) {
                    ws.mergeCells(dayStartRow, sd.col, rowNum - 1, sd.col);
                    const cell = ws.getCell(dayStartRow, sd.col);
                    cell.value = sd.val;
                    cell.alignment = centerAlign;
                    cell.border = borderThin;
                    cell.font = { size: 10 };
                    cell.fill = summaryFill;

                    if (sd.col === 12 && prod > 0) {
                        cell.font = { size: 10, bold: true, color: { argb: prod >= 85 ? 'FF059669' : 'FFDC2626' } };
                    }
                }

                // Merge date column
                ws.mergeCells(dayStartRow, 1, rowNum - 1, 1);
                const dateCell = ws.getCell(dayStartRow, 1);
                dateCell.value = dayNum;
                dateCell.alignment = centerAlign;
                dateCell.font = { bold: true, size: 10 };
                dateCell.fill = dayHeaderFill;
                dateCell.border = borderThin;
            }

            // Freeze panes
            ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];
        }

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `IPD_Report_${dateFrom}_to_${dateTo}.xlsx`;

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error: any) {
        console.error('Error exporting IPD:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
