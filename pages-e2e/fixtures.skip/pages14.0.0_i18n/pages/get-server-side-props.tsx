import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';

import LocaleSwitcher from '../components/locale-switcher';
import Links from '../components/links';
import LocaleInfo from '../components/locale-info';

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

export default function GetServeSidePropsPage(props: Props) {
	return (
		<div>
			<h1>getServerSideProps page</h1>
			<LocaleInfo locale={props.locale} locales={props.locales} />

			<LocaleSwitcher />

			<Links />
		</div>
	);
}

export const getServerSideProps: GetServerSideProps<{
	locale?: string;
	locales?: string[];
}> = async ({ locale, locales }) => {
	return {
		props: {
			locale,
			locales,
		},
	};
};

export const runtime = 'experimental-edge';
