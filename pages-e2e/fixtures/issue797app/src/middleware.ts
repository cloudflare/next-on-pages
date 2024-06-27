import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
	const nextResponse = NextResponse.next();
	nextResponse.headers.set(
		'X-header-from-middleware',
		'this is a header set by the middleware!',
	);
	return nextResponse;
}
