import { NextResponse } from 'next/server';

export function middleware(request) {
	if (request.nextUrl.pathname === '/api/middleware-test/unreachable') {
		return new NextResponse('The requested api route is unreachable');
	}

	if (request.nextUrl.pathname === '/middleware-test/unreachable') {
		return new NextResponse('The requested route is unreachable');
	}

	if (request.nextUrl.pathname === '/api/middleware-test/non-existent/api') {
		return new NextResponse('The requested api route is non-existent');
	}

	if (request.nextUrl.pathname === '/middleware-test/non-existent/page') {
		return new NextResponse('The requested route is non-existent');
	}

	if (request.nextUrl.searchParams.has('rewrite-to-page')) {
		return NextResponse.rewrite(new URL('/middleware-test/page', request.url));
	}

	if (request.nextUrl.searchParams.has('redirect-to-page')) {
		return NextResponse.redirect(new URL('/middleware-test/page', request.url));
	}

	if (request.nextUrl.searchParams.has('set-headers')) {
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set(
			'header-set-from-middleware',
			'this is a test header added by the middleware',
		);
		requestHeaders.set(
			'original-header-for-testing-b',
			'this header has been overridden by the middleware',
		);
		return NextResponse.next({
			request: {
				headers: requestHeaders,
			},
		});
	}

	if (request.nextUrl.searchParams.has('error')) {
		throw new Error('Error from middleware');
	}

	if (request.nextUrl.searchParams.has('soft-error')) {
		return new NextResponse('(Soft) Error from middleware', { status: 418 });
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/api/middleware-test/:path*', '/middleware-test/:path*'],
};
