import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { opdDailyShifts, nursingWards } from '@/db/schema';
import { eq, and, asc, gte, lte, inArray } from 'drizzle-orm';
import ExcelJS from 'exceljs';

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
    shifts: string[];
}

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

        // Fetch OPD wards
        const wardConditions = [eq(nursingWards.deptType, 'OPD'), eq(nursingWards.isActive, true)];
        if (wardIdFilter.length > 0) {
            wardConditions.push(inArray(nursingWards.id, wardIdFilter));
        }
        const wards = await db.select()
            .from(nursingWards)
            .where(and(...wardConditions))
            .orderBy(asc(nursingWards.code));

        if (wards.length === 0) {
            return NextResponse.json({ error: 'ไม่พบ Ward OPD ที่เลือก' }, { status: 404 });
        }

        const wardIds = wards.map(w => w.id);

        // Fetch all shifts in range
        const shifts = await db.select({
            wardId: opdDailyShifts.wardId,
            recordDate: opdDailyShifts.recordDate,
            shift: opdDailyShifts.shift,
            rnCount: opdDailyShifts.rnCount,
            nonRnCount: opdDailyShifts.nonRnCount,
            patientTotal: opdDailyShifts.patientTotal,
            categoryData: opdDailyShifts.categoryData,
            workloadScore: opdDailyShifts.workloadScore,
        })
            .from(opdDailyShifts)
            .where(and(
                gte(opdDailyShifts.recordDate, dateFrom),
                lte(opdDailyShifts.recordDate, dateTo),
                inArray(opdDailyShifts.wardId, wardIds),
            ))
            .orderBy(opdDailyShifts.recordDate, opdDailyShifts.shift);

        // Group shifts by ward
        const shiftsByWard: Record<number, typeof shifts> = {};
        for (const s of shifts) {
            if (!shiftsByWard[s.wardId]) shiftsByWard[s.wardId] = [];
            shiftsByWard[s.wardId].push(s);
        }

        // Collect all dates in range
        const allDates: string[] = [];
        const startDate = new Date(dateFrom);
        const endDate = new Date(dateTo);
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            allDates.push(d.toISOString().split('T')[0]);
        }

        // Format dates
        const dateFromObj = new Date(dateFrom);
        const dateToObj = new Date(dateTo);
        const thaiDateFrom = dateFromObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        const thaiDateTo = dateToObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

        // --- Styles ---
        const borderThin: Partial<ExcelJS.Borders> = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' },
        };
        const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
        const boldWhiteFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        const boldFont: Partial<ExcelJS.Font> = { bold: true, size: 10 };

        const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
        const staffFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        const categoryFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
        const calcFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        const totalRowFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        const dayHeaderFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

        const shiftLabelMap: Record<string, string> = { morning: 'ช', afternoon: 'บ', night: 'ด' };
        const shiftOrder: Record<string, number> = { morning: 1, afternoon: 2, night: 3 };

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Nursing Dashboard';
        workbook.created = new Date();

        // One sheet per ward
        for (const ward of wards) {
            const config = ward.opdFieldsConfig as OpdFieldsConfig | null;
            const activeShifts = config?.shifts
                ? [...config.shifts].sort((a, b) => (shiftOrder[a] || 99) - (shiftOrder[b] || 99))
                : ['morning', 'afternoon', 'night'];

            // Flatten all fields from config
            const allFields: FieldConfig[] = [];
            if (config?.groups) {
                for (const group of config.groups) {
                    for (const field of group.fields) {
                        allFields.push(field);
                    }
                }
            }

            // Sheet name (truncate to 31 chars for Excel limit)
            const sheetName = ward.name.length > 31 ? ward.name.substring(0, 31) : ward.name;
            const ws = workbook.addWorksheet(sheetName);

            // Build column structure:
            // A: วันที่ | B: เวร | C: RN | D: Non-RN | E: จำนวน Pt | [dynamic fields...] | Nursing Need | NHPPD(Expect) | อัตรากำลัง(Expect) | อัตรากำลัง(Actual) | NHPPD(Actual) | Productivity
            const fixedLeftCols = 5; // วันที่, เวร, RN, Non-RN, จำนวน Pt
            const dynamicCols = allFields.length;
            const fixedRightCols = 6; // Nursing Need, NHPPD(Expect), อัตรากำลัง(Expect), อัตรากำลัง(Actual), NHPPD(Actual), Productivity
            const totalCols = fixedLeftCols + dynamicCols + fixedRightCols;

            // Set column widths
            const colWidths: number[] = [
                8,  // วันที่
                5,  // เวร
                7,  // RN
                8,  // Non-RN
                9,  // จำนวน Pt
            ];
            for (let i = 0; i < dynamicCols; i++) colWidths.push(8);
            colWidths.push(12, 10, 10, 10, 10, 12); // right side cols

            ws.columns = colWidths.map(w => ({ width: w }));

            // Row 1: Title
            ws.mergeCells(1, 1, 1, totalCols);
            const titleCell = ws.getCell(1, 1);
            titleCell.value = `${ward.name}   ${thaiDateFrom} — ${thaiDateTo}`;
            titleCell.font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            ws.getRow(1).height = 28;

            // Row 2: Section headers
            // Staff section
            ws.mergeCells(2, 1, 2, fixedLeftCols);
            const staffHeader = ws.getCell(2, 1);
            staffHeader.value = 'จำนวนเวร เจ้า / จำนวน Pt';
            staffHeader.font = boldWhiteFont;
            staffHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
            staffHeader.alignment = centerAlign;
            staffHeader.border = borderThin;

            // Category section
            if (dynamicCols > 0) {
                ws.mergeCells(2, fixedLeftCols + 1, 2, fixedLeftCols + dynamicCols);
                const catHeader = ws.getCell(2, fixedLeftCols + 1);
                const groupNames = config?.groups?.map(g => g.name).join(' / ') || 'ผู้ป่วย';
                catHeader.value = groupNames;
                catHeader.font = boldWhiteFont;
                catHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
                catHeader.alignment = centerAlign;
                catHeader.border = borderThin;
            }

            // Calculation section
            ws.mergeCells(2, fixedLeftCols + dynamicCols + 1, 2, totalCols);
            const calcHeader = ws.getCell(2, fixedLeftCols + dynamicCols + 1);
            calcHeader.value = 'Nursing / Productivity';
            calcHeader.font = boldWhiteFont;
            calcHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
            calcHeader.alignment = centerAlign;
            calcHeader.border = borderThin;

            ws.getRow(2).height = 22;

            // Row 3: Sub-headers
            const subHeaders: string[] = [
                'วันที่', 'เวร', 'RN', 'Non-RN', 'จำนวน Pt',
            ];
            // Dynamic field headers with multiplier
            for (const f of allFields) {
                subHeaders.push(`${f.label}\n×${f.multiplier}`);
            }
            subHeaders.push('Nursing\nNeed/วัน', 'NHPPD\n(Expect)', 'อัตรากำลัง\n(Expect)', 'อัตรากำลัง\n(Actual)', 'NHPPD\n(Actual)', 'Productivity\n%');

            const row3 = ws.getRow(3);
            subHeaders.forEach((header, i) => {
                const cell = row3.getCell(i + 1);
                cell.value = header;
                cell.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
                cell.alignment = centerAlign;
                cell.border = borderThin;

                if (i < fixedLeftCols) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
                else if (i < fixedLeftCols + dynamicCols) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
                else cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
            });
            row3.height = 35;

            // Data rows
            let rowNum = 4;
            const wardShifts = shiftsByWard[ward.id] || [];

            // Group by date
            const shiftByDate: Record<string, Record<string, any>> = {};
            for (const s of wardShifts) {
                if (!shiftByDate[s.recordDate]) shiftByDate[s.recordDate] = {};
                shiftByDate[s.recordDate][s.shift] = s;
            }

            let dayNum = 0;
            for (const dateStr of allDates) {
                dayNum++;
                const dateShifts = shiftByDate[dateStr] || {};
                const dayStartRow = rowNum;

                // Accumulators for daily totals
                let dayNursingNeed = 0;
                let dayActualStaff = 0;

                for (const shiftKey of activeShifts) {
                    const s = dateShifts[shiftKey];
                    const rn = s?.rnCount || 0;
                    const nonRn = s?.nonRnCount || 0;
                    const ptTotal = s?.patientTotal || 0;
                    const catData = (s?.categoryData || {}) as Record<string, number>;

                    // Calculate workload for this shift
                    let shiftWorkload = 0;
                    for (const f of allFields) {
                        shiftWorkload += (catData[f.key] || 0) * f.multiplier;
                    }

                    const shiftActual = rn + nonRn;

                    // Accumulate for daily calculations
                    dayNursingNeed += shiftWorkload;
                    dayActualStaff += shiftActual;

                    // Per-shift expect
                    const shiftExpect = shiftWorkload / 7;
                    const shiftProductivity = shiftActual > 0 ? (shiftExpect / shiftActual) * 100 : 0;
                    const shiftNhppdExpect = ptTotal > 0 ? (shiftExpect * 7) / ptTotal : 0;
                    const shiftNhppdActual = ptTotal > 0 ? (shiftActual * 7) / ptTotal : 0;

                    // Build row data
                    const rowData: any[] = [
                        '', // date (will be merged)
                        shiftLabelMap[shiftKey] || shiftKey,
                        rn || '',
                        nonRn || '',
                        ptTotal || '',
                    ];
                    // Dynamic fields
                    for (const f of allFields) {
                        rowData.push(catData[f.key] || '');
                    }
                    // Calculated fields
                    rowData.push(
                        shiftWorkload > 0 ? parseFloat(shiftWorkload.toFixed(2)) : '',
                        shiftNhppdExpect > 0 ? parseFloat(shiftNhppdExpect.toFixed(1)) : '',
                        shiftExpect > 0 ? parseFloat(shiftExpect.toFixed(1)) : '',
                        shiftActual || '',
                        shiftNhppdActual > 0 ? parseFloat(shiftNhppdActual.toFixed(1)) : '',
                        shiftProductivity > 0 ? parseFloat(shiftProductivity.toFixed(2)) : '',
                    );

                    const dataRow = ws.getRow(rowNum);
                    rowData.forEach((val, i) => {
                        const cell = dataRow.getCell(i + 1);
                        cell.value = val;
                        cell.alignment = centerAlign;
                        cell.border = borderThin;
                        cell.font = { size: 10 };

                        // Color sections
                        if (i >= 2 && i < fixedLeftCols) cell.fill = staffFill;
                        else if (i >= fixedLeftCols && i < fixedLeftCols + dynamicCols) cell.fill = categoryFill;
                        else if (i >= fixedLeftCols + dynamicCols) cell.fill = calcFill;

                        // Color productivity
                        if (i === totalCols - 1 && shiftProductivity > 0) {
                            cell.font = { size: 10, bold: true, color: { argb: shiftProductivity >= 85 ? 'FF059669' : 'FFDC2626' } };
                        }
                    });

                    rowNum++;
                }

                // Merge date column
                if (rowNum > dayStartRow) {
                    ws.mergeCells(dayStartRow, 1, rowNum - 1, 1);
                }
                const dateCell = ws.getCell(dayStartRow, 1);
                dateCell.value = dayNum;
                dateCell.alignment = centerAlign;
                dateCell.font = { bold: true, size: 10 };
                dateCell.fill = dayHeaderFill;
                dateCell.border = borderThin;
            }

            // Freeze panes: freeze header rows
            ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];
        }

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `OPD_Report_${dateFrom}_to_${dateTo}.xlsx`;

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error: any) {
        console.error('Error exporting OPD:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
