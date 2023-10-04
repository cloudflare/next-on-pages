import { readdir, readFile, writeFile, mkdir } from 'fs/promises';

import imageToBase64 from 'image-to-base64';

const errorPagePath = './no-nodejs-compat-flag-static-error-page';

let indexHtmlContent = await readFile(
	`./${errorPagePath}/assets/index.html`,
	{ encoding: 'utf-8' },
);

const imgs = await readdir(`./${errorPagePath}/assets/img`);

await Promise.all(
	imgs.map(async img => {
		const base64Data = await imageToBase64(
			`./${errorPagePath}/assets/img/${img}`,
		);
		indexHtmlContent = indexHtmlContent.replace(
			`src="./img/${img}"`,
			`src="data:image/png;base64,${base64Data}"`,
		);
	}),
);

await mkdir(`./${errorPagePath}/dist`, { recursive: true });
await writeFile(`./${errorPagePath}/dist/index.html`, indexHtmlContent);
