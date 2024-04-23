import matter from 'gray-matter'
import { SerializeOptions } from 'next-mdx-remote/dist/types'
import { readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import rehypeSlug from 'rehype-slug'
import emoji from 'remark-emoji'
import { GuideTemplate } from '~/app/guides/GuideTemplate'
import { genGuideMeta, genGuidesStaticParams } from '~/features/docs/guides/GuidesMdx'
import { GUIDES_DIRECTORY, isValidGuideFrontmatter } from '~/lib/docs'
import { UrlTransformFunction, linkTransform } from '~/lib/mdx/plugins/rehypeLinkTransform'
import remarkMkDocsAdmonition from '~/lib/mdx/plugins/remarkAdmonition'
import { removeTitle } from '~/lib/mdx/plugins/remarkRemoveTitle'
import remarkPyMdownTabs from '~/lib/mdx/plugins/remarkTabs'

// We fetch these docs at build time from an external repo
const org = 'supabase'
const repo = 'wrappers'
const branch = 'main'
const docsDir = 'docs'
const externalSite = 'https://supabase.github.io/wrappers'

// Each external docs page is mapped to a local page
const pageMap = [
  {
    slug: 'airtable',
    meta: {
      title: 'Airtable',
    },
    remoteFile: 'airtable.md',
  },
  {
    slug: 'auth0',
    meta: {
      title: 'Auth0',
    },
    remoteFile: 'auth0.md',
  },
  {
    slug: 'bigquery',
    meta: {
      title: 'BigQuery',
    },
    remoteFile: 'bigquery.md',
  },
  {
    slug: 'clickhouse',
    meta: {
      title: 'ClickHouse',
    },
    remoteFile: 'clickhouse.md',
  },
  {
    slug: 'cognito',
    meta: {
      title: 'AWS Cognito',
    },
    remoteFile: 'cognito.md',
  },
  {
    slug: 'firebase',
    meta: {
      title: 'Firebase',
    },
    remoteFile: 'firebase.md',
  },
  {
    slug: 'logflare',
    meta: {
      title: 'Logflare',
    },
    remoteFile: 'logflare.md',
  },
  {
    slug: 'mssql',
    meta: {
      title: 'MSSQL',
    },
    remoteFile: 'mssql.md',
  },
  {
    slug: 'redis',
    meta: {
      title: 'Redis',
    },
    remoteFile: 'redis.md',
  },
  {
    slug: 's3',
    meta: {
      title: 'AWS S3',
    },
    remoteFile: 's3.md',
  },
  {
    slug: 'stripe',
    meta: {
      title: 'Stripe',
    },
    remoteFile: 'stripe.md',
  },
]

const WrappersDocs = async ({ params }: { params: { slug?: string[] } }) => {
  const { isExternal, meta, ...data } = await getContent(params)

  const options = isExternal
    ? ({
        mdxOptions: {
          remarkPlugins: [
            remarkMkDocsAdmonition,
            emoji,
            remarkPyMdownTabs,
            [removeTitle, meta.title],
          ],
          rehypePlugins: [[linkTransform, urlTransform], rehypeSlug],
        },
      } as SerializeOptions)
    : undefined

  return <GuideTemplate meta={meta} mdxOptions={options} {...data} />
}

/**
 * Fetch markdown from external repo
 */
const getContent = async (params: { slug?: string[] }) => {
  const federatedPage = pageMap.find(
    ({ slug }) => params && slug && params.slug && slug === params.slug.at(0)
  )

  let isExternal: boolean
  let meta: any
  let content: string
  let editLink: string

  if (!federatedPage) {
    isExternal = false
    editLink = `supabase/supabase/apps/docs/content/guides/database/extensions/wrappers/${params?.slug?.join(sep) || 'index'}.mdx`
    const rawContent = await readFile(
      join(
        GUIDES_DIRECTORY,
        'database',
        'extensions',
        'wrappers',
        `${params?.slug?.join(sep) || 'index'}.mdx`
      ),
      'utf-8'
    )
    ;({ data: meta, content } = matter(rawContent))
    if (!isValidGuideFrontmatter(meta)) {
      throw Error(`Expected valid frontmatter, got ${JSON.stringify(meta, null, 2)}`)
    }
  } else {
    isExternal = true
    let remoteFile: string
    ;({ remoteFile, meta } = federatedPage)
    const repoPath = `${org}/${repo}/${branch}/${docsDir}/${remoteFile}`
    editLink = `${org}/${repo}/blob/${branch}/${docsDir}/${remoteFile}`
    const response = await fetch(`https://raw.githubusercontent.com/${repoPath}`)
    content = await response.text()
  }

  return {
    pathname: `/guides/database/extensions/wrappers${params.slug?.length ? `/${params.slug.join('/')}` : ''}`,
    isExternal,
    editLink,
    meta,
    content,
  }
}

const urlTransform: UrlTransformFunction = (url) => {
  try {
    const externalSiteUrl = new URL(externalSite)

    const placeholderHostname = 'placeholder'
    const { hostname, pathname, hash } = new URL(url, `http://${placeholderHostname}`)

    // Don't modify a url with a FQDN or a url that's only a hash
    if (hostname !== placeholderHostname || pathname === '/') {
      return url
    }
    const relativePage = (
      pathname.endsWith('.md')
        ? pathname.replace(/\.md$/, '')
        : relative(externalSiteUrl.pathname, pathname)
    ).replace(/^\//, '')

    const page = pageMap.find(({ remoteFile }) => `${relativePage}.md` === remoteFile)

    // If we have a mapping for this page, use the mapped path
    if (page) {
      return page.slug + hash
    }

    // If we don't have this page in our docs, link to original docs
    return `${externalSite}/${relativePage}${hash}`
  } catch (err) {
    console.error('Error transforming markdown URL', err)
    return url
  }
}

const generateStaticParams = async () => {
  const mdxPaths = await genGuidesStaticParams('database/extensions/wrappers')()
  const federatedPaths = pageMap.map(({ slug }) => ({
    slug: [slug],
  }))

  return [...mdxPaths, ...federatedPaths]
}

const generateMetadata = genGuideMeta(getContent)

export default WrappersDocs
export { generateStaticParams, generateMetadata }
