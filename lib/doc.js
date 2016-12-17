const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp').sync
const titlecase = require('titlecase')
const semver = require('semver')
const marky = require('marky-markdown-lite')
const matter = require('gray-matter')
const toMarkdown = require('to-markdown')
const versions = require(path.join(__dirname, '../_data/versions.json')).map(v => v.version)
const hrefType = require('href-type')

module.exports = class Doc {
  constructor (props) {
    Object.assign(this, props)

    this.$ = marky(this.markdown_content)

    // Fix relative links
    this.$('a').each((i, el) => {
      const href = this.$(el).attr('href')
      const type = hrefType(href)
      if (type !== 'relative' && type !== 'rooted') return
      const dirname = path.dirname(`/docs/${this.filename}`)
      this.$(el).attr('href', path.resolve(dirname, href.replace(/\.md/, '')))
    })

    // Derive YML frontmatter for Jekyll
    this.frontmatter = {
      version: `v${versions[0]}`,
      category: this.category,
      redirect_from: this.redirects,
      source_url: `https://github.com/electron/electron/blob/master/docs/${this.filename}`,
      title: this.title,
      excerpt: this.excerpt,
      sort_title: path.basename(this.filename, '.md')
    }

    this.html = matter.stringify(toMarkdown(this.$.html()), this.frontmatter)
  }

  get outputFilename () {
    return path.join(__dirname, '../_docs/', this.filename)
  }

  save () {
    console.log(this.outputFilename)
    fs.writeFileSync(this.outputFilename, this.html)
  }

  get category () {
    if (this.filename.match('faq')) return 'FAQ'
    if (this.filename.match('api/')) return 'API'
    return titlecase(path.dirname(this.filename))
  }

  // generate redirect paths for all Electron versions prior to 1.0.0
  get redirects () {
    return versions
     .filter(v => semver.lt(v, '1.0.0'))
     .concat('latest')
     .map(v => `/docs/v${v}/${this.filename.replace(/\.md$/, '')}`)
  }

  get title () {
    return (this.$('h1').first().text() || this.$('h2').first().text())
    .trim()
    .replace(/\"/g, '\\\"')
    .replace(/^Class:\s*/, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  }

  get excerpt () {
    return (this.$('blockquote > p').first().html() || '')
    .replace(/\"/g, '\\\"')
    .replace(/\n/g, '\n    ')
  }

  get shouldBeOnWebsite () {
    const patterns = [
      'api/',
      'development/',
      'tutorial/',
      'faq'
    ]
    return patterns.some(pattern => !!this.filename.match(pattern))
  }
}