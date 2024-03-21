import noNodeJsRuntime from './rules/no-nodejs-runtime';
import noUnsupportedConfigs from './rules/no-unsupported-configs';
import noAppNodejsDynamicSSG from './rules/no-app-nodejs-dynamic-ssg';
import noPagesNodejsDynamicSSG from './rules/no-pages-nodejs-dynamic-ssg';

import type { ESLint } from 'eslint';

const config: ESLint.Plugin = {
	rules: {
		'no-nodejs-runtime': noNodeJsRuntime,
		'no-unsupported-configs': noUnsupportedConfigs,
		'no-app-nodejs-dynamic-ssg': noAppNodejsDynamicSSG,
		'no-pages-nodejs-dynamic-ssg': noPagesNodejsDynamicSSG,

		// the following rule is no longer needed/applicable, it has been converted into a noop (so that it doesn't introduce a breaking change)
		// it should be removed in the next package major release
		'no-app-not-found-runtime': () => ({}),
	},
	configs: {
		recommended: {
			plugins: ['eslint-plugin-next-on-pages'],
			rules: {
				'next-on-pages/no-nodejs-runtime': 'error',
				'next-on-pages/no-unsupported-configs': 'error',
				'next-on-pages/no-app-nodejs-dynamic-ssg': 'error',
				'next-on-pages/no-pages-nodejs-dynamic-ssg': 'error',
			},
		},
	},
};

export = config;
