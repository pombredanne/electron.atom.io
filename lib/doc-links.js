#!/usr/bin/env node

var fs = require('fs')
var glob = require('glob')
var path = require('path')

// We are parsing the doc files for links
// to other pages within the docs (relative links,
// rather than external).
//
// We're looking for these patterns in traditional markdown link syntax:
// - [words](../abc/abc.md)
// - [words](../abc/abc)
// - [words](abc)
// - [words](abc.md)
// - [words](#abc-efg)
// - [words](../abc/abc.html)
// - [words](/abc/abc.html)
// - [words](_abc/abc/abc.html)
//
// And these in inline footer link syntax:
// - [words]: ../abc/abc.md
// - [words]: ../abc/abc
// - [words]: abc
// - [words]: abc.md
// - [words]: #abc-efg
// - [words]: ../abc/abc.html
// - [words]: /abc/abc.html
// - [words]: _abc/abc/abc.html

var getFileDir = function getFileDir (p) {
  var array = p.split(path.sep)
  return array[array.length - 2]
}

var getLinks = function getLinks (content) {
  var tradRegex = /\[(?:[^\]]|\[\])+\]\((?!http)([^\)]+)\)/mg
  var footRegex = /\[[^\]]+\]:[\r\n\s]+((?!http).+)/mg
  var tradLinks = content.match(tradRegex) || []
  var footLinks = content.match(footRegex) || []
  var links = tradLinks.concat(footLinks)
  return links
}
exports.getLinks = getLinks

var fixLink = function fixLink(file, link) {
  var baseUrl = 'electron.atom.io/docs/'
  var tradLinkStyle = true
  var parts
  var bracket

  if (link.match(/\]\(/)) {
    parts = link.split('](')
  } else {
    parts = link.split(']:')
    tradLinkStyle = false
  }
  var href = parts[1].trim()
  if (tradLinkStyle) href = href.slice(0, href.length - 1)

  if (tradLinkStyle) bracket = parts[0] + ']'
  else bracket = parts[0] + ']: '

  if (!href.match(/\.md/ig)) return link

  var newLink = href.replace(/\.md/ig, '')
  if (newLink.match('structures')) {
    newLink = 'http://' + path.join(baseUrl, 'api', newLink).split(path.sep).join('/')
    if (tradLinkStyle) newMdLink = bracket + '(' + newLink + ')'
    else newMdLink = bracket + newLink
    return newMdLink
  } else if (newLink.indexOf('../') > -1) {
    newLink = 'http://' + path.join(baseUrl, newLink.replace('../', '')).split(path.sep).join('/')
    if (tradLinkStyle) newMdLink = bracket + '(' + newLink + ')'
    else newMdLink = bracket + newLink
    return newMdLink
  } else if (newLink.indexOf('./') > -1 || newLink.indexOf('/') < 0) {
    var fileDir = getFileDir(file)
    newLink = 'http://' + path.join(baseUrl, fileDir, newLink).split(path.sep).join('/')
    if (tradLinkStyle) newMdLink = bracket + '(' + newLink + ')'
    else newMdLink = bracket + newLink
    return newMdLink
  }
  return newLink
}
exports.fixLink = fixLink

exports.fixLinks = function fixLinks (dir, version, callback) {
  var filesWithLinks = 0
  var filesToCheck = 0
  var filesProcessed = 0
  var done = false

  glob('**/*.md', {cwd: dir}, function globbing (error, files) {
    if (error) return callback(error)
    if (files.length === 0) return callback(new Error('Globbed no files.'))
    filesToCheck = files.length
    files.forEach(function (file, i) {
      file = path.join(dir, file)
      findLinks(file, i)
    })
    if (filesWithLinks === 0) return callback(new Error('Found no relative links in files.'))
  })

  function findLinks (file, i) {
    var content = fs.readFileSync(file).toString()
    var links = getLinks(content)

    if (links.length > 0) {
      filesWithLinks++
      fixInternalLinks(file, content, links)
    }
    if (filesToCheck === (i + 1)) done = true
  }

  function fixInternalLinks (file, content, links) {
    var newLinks = links.map(function (link) {
      return fixLink(file, link)
    })
    replaceLinksInContent(file, content, links, newLinks)
  }

  function replaceLinksInContent (file, content, oldLinks, newLinks) {
    oldLinks.forEach(function (oldLink, i) {
      content = content.replace(oldLink, newLinks[i])
    })

    // Work around kramdown's misinterpretation of pipe as a table header
    // https://github.com/electron/electron.atom.io/issues/556
    content = content
      .split('\n')
      .map(line => line.match(/^\s*\* `/) ? line.replace(/ \| /g, ' &#124; ') : line)
      .join('\n')

    writeLinkstoFile(file, content)
  }

  function writeLinkstoFile (file, content) {
    fs.writeFile(file, content, function (error) {
      if (error) return callback(error)
      filesProcessed++
      if ((filesProcessed === filesWithLinks) && done) {
        callback(null, 'done')
      }
    })
  }
}
