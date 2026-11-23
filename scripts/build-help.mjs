// Builds the offline help file: every page under docs/src/pages/docs is
// rendered to plain HTML and compiled into src-tauri/resources/help/Jan.chm.
//
// The build machine needs a CHM compiler: Microsoft HTML Help Workshop
// (hhc.exe) or Free Pascal's chmcmd. CHM_COMPILER names another one.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluate } from '@mdx-js/mdx'
import { Children, Fragment, createElement as h } from 'react'
import * as runtime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const docs = path.join(repoRoot, 'docs/src/pages/docs')
const chm = path.join(repoRoot, 'src-tauri/resources/help/Jan.chm')
const site = 'https://www.jan.ai'
const sections = [
  { dir: 'desktop', title: 'Jan Desktop' },
  { dir: 'agent', title: 'Jan Agent' },
]

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// A page is named by its path under `docs` without the extension, e.g.
// `desktop/install/windows`.
function findPages(dir) {
  return fs.readdirSync(path.join(docs, dir), { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return findPages(`${dir}/${entry.name}`)
    return entry.name.endsWith('.mdx') ? [`${dir}/${entry.name.slice(0, -'.mdx'.length)}`] : []
  })
}
const pages = new Set(sections.flatMap((section) => findPages(section.dir)))

// The contents tree follows the sidebar the site builds from _meta.json.
function readContents(dir) {
  const meta = JSON.parse(fs.readFileSync(path.join(docs, dir, '_meta.json'), 'utf8'))
  return Object.entries(meta).flatMap(([key, value]) => {
    const { title, type, display } = typeof value === 'string' ? { title: value } : value
    if (type === 'separator') return [{ title, separator: true }]
    if (display === 'hidden') return []
    const children = fs.existsSync(path.join(docs, dir, key, '_meta.json')) ? readContents(`${dir}/${key}`) : undefined
    const page = [`${dir}/${key}`, `${dir}/${key}/index`].find((candidate) => pages.has(candidate))
    return page || children ? [{ title, page, children }] : []
  })
}

// Links between pages become relative links inside the help file; a link to
// anything else on the site keeps pointing at the site.
function resolveLink(from, href) {
  if (/^(https?:|mailto:|#)/.test(href)) return href
  const [target, anchor] = href.split('#')
  const absolute = target.startsWith('/') ? target : path.posix.join('/docs', path.posix.dirname(from), target)
  const name = absolute.replace(/^\/docs\//, '').replace(/\/$/, '')
  const page = [name, `${name}/index`].find((candidate) => pages.has(candidate))
  const suffix = anchor ? `#${anchor}` : ''
  if (!absolute.startsWith('/docs/') || !page) return `${site}${absolute}${suffix}`
  return `${path.posix.relative(path.posix.dirname(from), page)}.html${suffix}`
}

// Stand-ins for the components the site renders the pages with.
function components(from, images) {
  const Tabs = ({ items = [], children }) => h('div', { className: 'tabs' }, Children.map(children, (tab, index) => h('div', { className: 'tab' }, h('p', { className: 'title' }, items[index]), tab)))
  Tabs.Tab = ({ children }) => h(Fragment, null, children)
  return {
    Callout: ({ type = 'default', children }) => h('div', { className: `callout ${type}` }, children),
    Steps: ({ children }) => h('div', { className: 'steps' }, children),
    Tabs,
    DocCards: ({ children }) => h('div', { className: 'cards' }, children),
    DocCard: ({ title, href, children }) => h('div', { className: 'card' }, h('p', { className: 'title' }, h('a', { href: resolveLink(from, href) }, title)), h('p', null, children)),
    FAQBox: ({ title, children }) => h('div', { className: 'card' }, h('p', { className: 'title' }, title), children),
    DownloadButton: () => null,
    Link: ({ href, children }) => h('a', { href: resolveLink(from, href) }, children),
    a: ({ href = '', children }) => h('a', { href: resolveLink(from, href) }, children),
    // A remote image would be fetched whenever the page opens, so it is only
    // linked.
    img: ({ src = '', alt = '' }) => {
      if (/^https?:/.test(src)) return h('a', { href: src }, alt || src)
      images.add(path.posix.join(path.posix.dirname(from), src))
      return h('img', { src, alt })
    },
  }
}

async function renderPage(page, images) {
  let source = fs.readFileSync(path.join(docs, `${page}.mdx`), 'utf8')
  const frontMatter = /^---\n([\s\S]*?)\n---\n/.exec(source)
  if (frontMatter) source = source.slice(frontMatter[0].length)
  const title = frontMatter && /^title:\s*(.+)$/m.exec(frontMatter[1])?.[1].replace(/^['"]|['"]$/g, '')

  // The imports name the site's components; the stand-ins replace them, and an
  // icon renders as nothing.
  const icons = {}
  let inCode = false
  const body = source.split('\n').filter((line) => {
    if (/^\s*(```|~~~)/.test(line)) inCode = !inCode
    const imported = !inCode && /^import\s+(.+?)\s+from\s+['"]([^'"]+)['"]/.exec(line)
    if (imported && imported[2] === 'lucide-react') {
      for (const name of imported[1].replace(/[{}\s]/g, '').split(',')) icons[name] = () => null
    }
    return !imported
  })

  const { default: Content } = await evaluate(body.join('\n'), { ...runtime, remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] })
  const rendered = renderToStaticMarkup(h(Content, { components: { ...icons, ...components(page, images) } }))
  // Like a remote image, a remote video is only linked.
  const html = rendered.replace(/<video[^>]*>\s*<source src="([^"]+)"[^>]*>\s*<\/video>/g, '<a href="$1">$1</a>')
  const stylesheet = `${'../'.repeat(page.split('/').length - 1)}help.css`
  return {
    title: title ?? page,
    html: `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta http-equiv="X-UA-Compatible" content="IE=edge">\n<title>${escapeHtml(title ?? page)}</title>\n<link rel="stylesheet" href="${stylesheet}">\n</head>\n<body>\n${html}\n</body>\n</html>\n`,
  }
}

// The contents and index files are read as ANSI text, so names keep ASCII only.
function sitemapItem(title, page) {
  const name = escapeHtml(title.replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim())
  const local = page ? `<param name="Local" value="${page}.html">` : ''
  return `<LI><OBJECT type="text/sitemap"><param name="Name" value="${name}">${local}</OBJECT>`
}

// A separator opens a group that runs until the next separator.
function sitemapTree(entries) {
  const lines = ['<UL>']
  let grouped = false
  for (const entry of entries) {
    if (entry.separator && grouped) lines.push('</UL>')
    lines.push(sitemapItem(entry.title, entry.page))
    if (entry.separator) lines.push('<UL>')
    if (entry.children) lines.push(sitemapTree(entry.children))
    grouped ||= Boolean(entry.separator)
  }
  if (grouped) lines.push('</UL>')
  lines.push('</UL>')
  return lines.join('\n')
}

const sitemap = (list) => `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML//EN">\n<HTML><HEAD></HEAD><BODY>\n${list}\n</BODY></HTML>\n`

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'jan-help-'))
const write = (name, content) => {
  fs.mkdirSync(path.dirname(path.join(work, name)), { recursive: true })
  fs.writeFileSync(path.join(work, name), content)
}

const images = new Set()
const titles = []
for (const page of pages) {
  const { title, html } = await renderPage(page, images)
  titles.push({ title, page })
  write(`${page}.html`, html)
}
for (const image of images) write(image, fs.readFileSync(path.join(docs, image)))
write('help.css', fs.readFileSync(new URL('./build-help.css', import.meta.url)))

const contents = sections.map(({ dir, title }) => ({ title, page: `${dir}/index`, children: readContents(dir) }))
const index = titles.sort((a, b) => a.title.localeCompare(b.title)).map(({ title, page }) => sitemapItem(title, page))
// The project file names files on disk, so it uses the platform's separator.
const files = [...[...pages].map((page) => `${page}.html`), ...images, 'help.css'].map((file) => path.normalize(file))
write('toc.hhc', sitemap(sitemapTree(contents)))
write('index.hhk', sitemap(['<UL>', ...index, '</UL>'].join('\n')))
write('Jan.hhp', ['[OPTIONS]', 'Compatibility=1.1 or later', 'Compiled file=Jan.chm', 'Contents file=toc.hhc', 'Index file=index.hhk', `Default topic=${path.normalize('desktop/index.html')}`, 'Full-text search=Yes', 'Language=0x409 English (United States)', 'Title=Jan Help', '', '[FILES]', ...files, ''].join('\r\n'))

// hhc exits with 1 on success, so the compiled file is the only reliable sign
// that a compiler ran.
const compilers = [process.env.CHM_COMPILER, 'hhc', 'C:\\Program Files (x86)\\HTML Help Workshop\\hhc.exe', 'chmcmd'].filter(Boolean)
const output = []
const compiled = compilers.some((compiler) => {
  const run = spawnSync(compiler, ['Jan.hhp'], { cwd: work, encoding: 'utf8' })
  output.push(`${compiler}: ${run.error?.message ?? run.stdout + run.stderr}`)
  return fs.existsSync(path.join(work, 'Jan.chm'))
})
if (!compiled) {
  console.error(output.join('\n'))
  throw new Error('No CHM compiler produced the help file. Install HTML Help Workshop (hhc.exe) or Free Pascal (chmcmd), or set CHM_COMPILER.')
}
fs.mkdirSync(path.dirname(chm), { recursive: true })
fs.copyFileSync(path.join(work, 'Jan.chm'), chm)
fs.rmSync(work, { recursive: true })
console.log(`Built ${path.relative(repoRoot, chm)}: ${pages.size} pages, ${images.size} images`)
