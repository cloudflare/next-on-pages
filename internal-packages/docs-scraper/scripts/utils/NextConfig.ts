export type NextConfig = {
	configName: string;
	urls: {
		type: 'app' | 'pages';
		href: string;
	}[];
};
