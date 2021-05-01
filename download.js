#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const promisify = f => (...args) => new Promise((resolve, reject) => {
  f(...args, (err, data) => {
    if (err) return reject(err);
    return resolve(data);
  });
});

const download = promisify(function(url, dest, cb) {
  if (fs.existsSync(dest)) {
    cb();
  }

  var file = fs.createWriteStream(dest);

  console.log('downloading', dest);
  const transport = url.match(/https/) ? https : http;

  var request = transport.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb);
    });
  }).on('error', function(err) {
    fs.unlink(dest);
    if (cb) cb(err.message);
  });
});
const readFile = promisify(fs.readFile.bind(fs));
const writeFile = promisify(fs.writeFile.bind(fs));
const mkdir = promisify(fs.mkdir.bind(fs));

const reducer = (p, c) => {
  if (c.match('####')) {
    p.current = c.split('#### ')[1];
    p.links[p.current] = p.links[p.current] || [];
  } else if (p.current) {
    const name = c.match(/\[(.*)\]/)[1]
    const url = c.match(/\]\((.*)\)/)[1]
    const obj = { name, url }

    p.links[p.current].push(obj)
  }

  return p;
}

const defaultReduced = { current: '', links: {} };

const downloadLinks = key => async ({ name, url }) => {
  const p = path.join(key, `${name}.pdf`);
  return download(url, p)
}

const main = async () => {
  const data = await readFile('./README.md', 'utf8')
  const transformed = data.split('\n').filter(Boolean).reduce(reducer, defaultReduced)
  for (const key of Object.keys(transformed.links)) {
    try { await mkdir(key) } catch (e) {}
    await Promise.all(transformed.links[key].map(downloadLinks(key)));
  }
}

main().catch(console.log).then(process.exit);
