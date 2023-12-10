import addOneWasm from './add-one.wasm?module';

export const config = { runtime: 'experimental-edge' };

export async function getServerSideProps() {
	const addOneWasmModule = await WebAssembly.instantiate(addOneWasm);
	const addOne = addOneWasmModule.exports.add_one;

	const n = 4;
	const result = addOne(4);
	const message = `WASM says that ${n} + 1 = ${result}`;

	return {
		props: { message },
	};
}

export default function WasmAddOnePage({ message }) {
	return (
		<>
			<h1>{message}</h1>
		</>
	);
}
