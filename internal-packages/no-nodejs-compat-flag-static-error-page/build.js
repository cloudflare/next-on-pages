const { readdir, readFile, writeFile, mkdir } = require('fs/promises');
const imageToBase64 = require('image-to-base64');

(async () => {
    let indexHtmlContent = await readFile('./assets/index.html', { encoding: 'utf-8' });

    const imgs = await readdir('./assets/img');

    await Promise.all(
        imgs.map(async img => {
            const base64Data = await imageToBase64(`./assets/img/${img}`);
            indexHtmlContent = indexHtmlContent.replace(`src="./img/${img}"`, `src="data:image/png;base64,${base64Data}"`);
        }));

    await mkdir('dist', { recursive: true });
    await writeFile('./dist/index.html', indexHtmlContent);
})();


// imageToBase64("./assets/img/input.png") // Path to the image
//     .then(
//         (response) => {
//             console.log(response); // "cGF0aC90by9maWxlLmpwZw=="
//         }
//     )
//     .catch(
//         (error) => {
//             console.log(error); // Logs an error if there was one
//         }
//     )