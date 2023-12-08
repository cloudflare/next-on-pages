import { useRouter } from 'next/router';
import LocaleSwitcher from '../components/locale-switcher';
import Links from '../components/links';
import LocaleInfo from '../components/locale-info';

export default function IndexPage() {
	const router = useRouter();
	const { locale, locales } = router;

	return (
		<div>
			<h1>Index page</h1>
			<LocaleInfo locale={locale} locales={locales} />

			<LocaleSwitcher />

			<Links />
		</div>
	);
}
