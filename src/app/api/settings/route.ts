import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

interface AppSettings {
    mainUrl: string;
    summarySheet: string;
    ipdSheet: string;
    opdSheet: string;
}

const defaultSettings: AppSettings = {
    mainUrl: '',
    summarySheet: 'Daily_Summary',
    ipdSheet: 'IPD_Workforce',
    opdSheet: 'OPD_Workforce'
};

// GET - Read settings
export async function GET() {
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
        const settings = JSON.parse(data);
        return NextResponse.json(settings);
    } catch (error: any) {
        // If file doesn't exist, return default settings
        if (error.code === 'ENOENT') {
            return NextResponse.json(defaultSettings);
        }
        console.error('Error reading settings:', error);
        return NextResponse.json(defaultSettings);
    }
}

// POST - Save settings
export async function POST(request: NextRequest) {
    try {
        const settings: AppSettings = await request.json();
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
        return NextResponse.json({ success: true, settings });
    } catch (error: any) {
        console.error('Error saving settings:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
