import type { GetStaticProps, InferGetStaticPropsType } from 'next';
import { useRouter } from 'next/router';
import LocaleSwitcher from '../../components/locale-switcher';
import Links from '../../components/links';
import LocaleInfo from '../../components/locale-info';

type Props = InferGetStaticPropsType<typeof getServerSideProps>;

export default function GetStaticPropsDynamicPage(props: Props) {
	const router = useRouter();
	const { isFallback, query } = router;

	if (isFallback) {
		return 'Loading...';
	}

	return (
		<div>
			<h1>getStaticProps (dynamic) page</h1>

			<LocaleInfo locale={props.locale} locales={props.locales} />

			<LocaleSwitcher />

			<Links />
		</div>
	);
}

export const getServerSideProps: GetStaticProps<{
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
