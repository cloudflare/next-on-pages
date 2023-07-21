import type { Page, Request } from 'playwright';

export async function collectHardNavigationRequests(page: Page): Promise<Request[]> {
    const requests: Request[] = [];

    await page.route('**/*', route => {
        const request = route.request();
        if(isHardNavigationRequest(request)) {
            requests.push(request);
        }
        route.continue();
    });

    return requests;
}

function isHardNavigationRequest(request: Request) {
    const urlObj = new URL(request.url());

    const searchParams = urlObj.searchParams;

    const isNextInternalRequest = urlObj.pathname.startsWith('/_next');
    if (isNextInternalRequest) return false;

    const isPrefetch = request.headers()["next-router-prefetch"] === "1";
    if (isPrefetch) return false;

    const isReactServerComponentRequest = request.headers()['rsc'] === "1" || !!searchParams.get('_rsc');
    if (isReactServerComponentRequest) return false;

    return true;
}