import {
	formatResizingResponse,
	getResizingProperties,
} from 'build-output-router/images';

/**
 * Handles image resizing requests.
 *
 * @param request Incoming request.
 * @param config Images configuration from the Vercel build output.
 * @returns Resized image response if the request is valid, otherwise a 400 response.
 */
export async function handleImageResizingRequest(
	request: Request,
	{ buildOutput, assetsFetcher, imagesConfig }: ImageResizingOpts,
): Promise<Response> {
	const opts = getResizingProperties(request, imagesConfig);

	if (!opts) {
		return new Response('Invalid image resizing request', { status: 400 });
	}

	const { isRelative, imageUrl } = opts;

	// TODO: implement proper image resizing

	const imgFetch =
		isRelative && imageUrl.pathname in buildOutput
			? assetsFetcher.fetch.bind(assetsFetcher)
			: fetch;

	const imageResp = await imgFetch(imageUrl);

	return formatResizingResponse(imageResp, imageUrl, imagesConfig);
}

type ImageResizingOpts = {
	buildOutput: VercelBuildOutput;
	assetsFetcher: Fetcher;
	imagesConfig?: VercelImagesConfig;
};
