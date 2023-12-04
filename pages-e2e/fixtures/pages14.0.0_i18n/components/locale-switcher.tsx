import Link from 'next/link'
import { useRouter } from 'next/router'

export default function LocaleSwitcher() {
  const router = useRouter()
  const { locales, locale: activeLocale } = router

  const otherLocales = (locales ?? []).filter(
    (locale) => locale !== activeLocale
  )

  return (
    <div data-test-id="locale-switcher" style={{ display: 'flex', marginBlock: '1rem', border: '1px solid black', padding: '.15rem', borderRadius: '5px', width: '15rem' }}>
      <span>Locale switcher:</span>
      <ul style={{ display: 'flex', listStyle: 'none', gap: '1rem', margin: 0, paddingInlineStart: '.5rem', marginInline: 'auto'}}>
        {otherLocales.map((locale) => {
          const { pathname, query, asPath } = router
          return (
            <li key={locale}>
              <Link
                href={{ pathname, query }}
                as={asPath}
                locale={locale}
              >
                {locale}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
