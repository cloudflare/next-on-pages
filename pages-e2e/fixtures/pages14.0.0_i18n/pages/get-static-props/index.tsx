import type { GetStaticProps, InferGetStaticPropsType } from 'next'

import LocaleSwitcher from '../../components/locale-switcher'
import Links from '../../components/links'
import LocaleInfo from '../../components/locale-info'

type Props = InferGetStaticPropsType<typeof getStaticProps>

export default function GetStaticPropsPage(props: Props) {
  return (
    <div>
      <h1>getStaticProps page</h1>

      <LocaleInfo locale={props.locale} locales={props.locales} />

      <LocaleSwitcher />

      <Links />
    </div>
  )
}

export const getStaticProps: GetStaticProps<{
  locale?: string
  locales?: string[]
}> = async ({
  locale,
  locales,
}) => {
  return {
    props: {
      locale,
      locales,
    },
  }
}
