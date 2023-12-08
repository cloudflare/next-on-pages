import { useRouter } from 'next/router';

type Props = {
	locale?: string;
	locales?: string[];
};

export default function getLocaleInfo({ locale, locales }: Props) {
	const router = useRouter();
	const { defaultLocale } = router;

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: '.5rem',
				border: '1px solid black',
				padding: '.15rem',
				borderRadius: '5px',
				width: '20rem',
			}}
		>
			<span data-test-id="locale-info__current-locale">
				Current locale: {locale}
			</span>
			<span data-test-id="locale-info__default-locale">
				Default locale: {defaultLocale}
			</span>
			<span data-test-id="locale-info__configured-locales">
				Configured locales: {[...(locales ?? [])].sort()?.join(', ')}
			</span>
		</div>
	);
}
