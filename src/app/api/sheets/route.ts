import { NextResponse } from 'next/server';

// Allowlist of domains that can be fetched via this proxy
const ALLOWED_HOSTS = ['docs.google.com', 'sheets.googleapis.com'];

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Validate target URL to prevent SSRF
    try {
        const parsedUrl = new URL(targetUrl);
        if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
            return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    try {
        const response = await fetch(targetUrl);
        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch remote resource' }, { status: 502 });
        }
        const text = await response.text();
        return new NextResponse(text, {
            headers: { 
                'Content-Type': 'text/plain',
            },
        });
    } catch (error: any) {
        console.error('Sheets proxy error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
