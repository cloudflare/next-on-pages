import { NextResponse } from 'next/server';

export function middleware(request) {
	// Note: the following is commented out because Pages on Next <= 13
	// can't return a response (this actually fails `next build`)
	// (https://nextjs.org/docs/messages/returning-response-body-in-middleware)
	// (we can enabled it if we were to drop support for older Pages projects)
	//
	// if (request.nextUrl.pathname === '/api/middleware-test/unreachable') {
	// 	return new NextResponse('The requested api route is unreachable');
	// }
	//
	// if (request.nextUrl.pathname === '/middleware-test/unreachable') {
	// 	return new NextResponse('The requested route is unreachable');
	// }
	//
	// if (request.nextUrl.pathname === '/api/middleware-test/non-existent/api') {
	// 	return new NextResponse('The requested api route is non-existent');
	// }
	//
	// if (request.nextUrl.pathname === '/middleware-test/non-existent/page') {
	// 	return new NextResponse('The requested route is non-existent');
	// }
	//

	if (request.nextUrl.searchParams.has('rewrite-to-page')) {
		return NextResponse.rewrite(new URL('/middleware-test-page', request.url));
	}

	if (request.nextUrl.searchParams.has('redirect-to-page')) {
		return NextResponse.redirect(new URL('/middleware-test-page', request.url));
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

	if (request.nextUrl.searchParams.has('json')) {
		return NextResponse.json({ text: 'json response from middleware' });
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/api/middleware-test/:path*', '/middleware-test-page'],
};
