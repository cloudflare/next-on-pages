import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
	if (req.url.includes('?rewrite=1')) {
		return NextResponse.rewrite(req.url, { status: 401 });
	}

	return new NextResponse('TEST', { status: 403 });
}
