#!/usr/bin/env node

const sqlite3 = require('sqlite3'),
  sqlite = require('sqlite'),
  fs = require("fs");

const fsPromises = fs.promises,
  path = require("path"),
  stream = require("stream"),
  utils = require("./utils"),
  util = require('util'),
  rimraf = require("rimraf");

class FileCache {
  constructor(opts) {
    this.opts = this.parseopts(opts);

    try {
      fs.mkdirSync(this.opts.dir);
    } catch (err) {

    }
  }

  parseopts(opts) {
    let o = {};

    // determine cache directory
    if (!opts.hasOwnProperty("dir") || typeof opts.dir !== "string") opts.dir = "cache";
    o.dir = path.resolve(process.cwd(), opts.dir);

    // determine maximal total number of files
    opts.files = (!opts.hasOwnProperty("files")) ? false : parseInt(opts.files, 10);
    o.files = (isNaN(opts.files) || opts.files === 0) ? false : opts.files;

    // determine maximal total file size
    if (!opts.hasOwnProperty("size")) opts.size = false;
    if (typeof opts.size === "string") opts.size = utils.filesize(opts.size);
    if (typeof opts.size !== "number" || isNaN(opts.size) || opts.size === 0) opts.size = false;
    o.size = opts.size;

    return o;
  }

  async open_sqlite() {
    // this SQLITE database stores LRU cache information.
    // COLUMNS  are below
    // key, access_time
    if (!this.db) {
      this.db = await sqlite.open({
        filename: this.opts.dir + '/lru-database.db',
        driver: sqlite3.cached.Database
      });
      await this.db.exec('CREATE TABLE IF NOT EXISTS LRUCache ("cache_key" TEXT, "access_time" INTEGER, "bytes" INTEGER)');
      await this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_key ON LRUCache (cache_key);');
      await this.db.exec('CREATE INDEX IF NOT EXISTS idx_access_time ON LRUCache (access_time);')
      await this.db.exec('CREATE INDEX IF NOT EXISTS idx_bytes ON LRUCache (bytes);')
    }
  }

  async keys() {
    await this.open_sqlite();
    try {
      const results = await this.db.all('SELECT cache_key FROM LRUCache');
      return results.map(x => x.cache_key);
    } catch (e) {
      return [];
    }
  }

  async has(file) {
    await this.open_sqlite();
    try {
      const result = await this.db.get('SELECT cache_key FROM LRUCache WHERE cache_key = ?', file);
      return result ? true : false;
    } catch (e) {
      return false;
    }
  }

  async set(file, data) {
    await this.open_sqlite();
    if (file.indexOf("/") >= 0) {
      throw new Error("'/' is not supported character as key.");
    }

    let resolved_file = await this.get_resolved_file(file);

    if ((data instanceof stream) || (data instanceof stream.Readable) || (data.readable === true)) {
      // pipe stream to file
      await new Promise((resolve, reject) => {
        data.pipe(fs.createWriteStream(resolved_file).on("finish", function() {
          resolve(resolved_file);
        }).on("error", function(err) {
          reject(err);
        }));
      });

    } else if (data instanceof Buffer) {
      // write buffer to file
      await fsPromises.writeFile(resolved_file, data);
    } else if (typeof data === "object") {
      await fsPromises.writeFile(resolved_file, JSON.stringify(data));
    } else {
      // write to file
      await fsPromises.writeFile(resolved_file, data);
    }

    let filestat = await fsPromises.stat(resolved_file);

    await this.db.run(`INSERT OR REPLACE INTO LRUCache(cache_key,access_time,bytes) VALUES (?,?,?)`, [file, Date.now(), filestat["size"]]);
    await this.cache_cleaner();
    return resolved_file;
  }

  async get_resolved_file(file) {
    if (file.indexOf("/") >= 0) {
      throw new Error("'/' is not supported character as key.");
    }

    return path.resolve(this.opts.dir, utils.sanitize(file));
  }

  async delete(file) {
    await this.open_sqlite();
    let resolved_file = path.resolve(this.opts.dir, utils.sanitize(file));
    if (await this.has(file)) {
      await fsPromises.unlink(resolved_file);
      await this.db.run(`DELETE FROM LRUCache WHERE cache_key = ?`, file);
      return true;
    } else {
      return false;
    }
  }

  async touch(file, time) {
    await this.open_sqlite();
    if (await this.has(file)) {
      await this.db.exec(`UPDATE LRUCache SET access_time = ${time? time : Date.now()} WHERE cache_key = "${file}"`);
      return true;
    } else {
      throw new Error("KEY_NOT_FOUND");
    }
  }

  async get(file) {
    await this.open_sqlite();
    let resolved_file = path.resolve(this.opts.dir, utils.sanitize(file));
    if (await this.has(file)) {
      await this.touch(file);
      return fsPromises.readFile(resolved_file);
    } else {
      return undefined;
    }
  }

  async stream(file, opts) {
    let resolved_file = path.resolve(this.opts.dir, utils.sanitize(file));

    if (await this.has(file)) {
      await this.touch(file);
      return fs.createReadStream(resolved_file, opts);
    } else {
      return undefined;
    }
  }

  async clear() {
    await this.open_sqlite();
    var self = this;
    await this.db.run('DELETE FROM LRUCache');
    this.db = null;
    return new Promise((resolve, reject) => {
      rimraf(self.opts.dir, err => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  async cache_cleaner() {
    // remove file if total files exceed given count
    if (this.opts.files) {
      let result = await this.db.get(`SELECT COUNT(*) as count FROM LRUCache`);
      if (result.count > this.opts.files) {
        let to_delete_file = await this.db.get("SELECT cache_key from LRUCache ORDER BY access_time ASC LIMIT 1");
        await this.delete(to_delete_file.cache_key);
      }
    }

    if (this.opts.size) {
      let result = await this.db.get(`SELECT SUM(bytes) as total_bytes FROM LRUCache`);
      if (result.total_bytes > this.opts.size) {
        let to_delete_file = await this.db.get("SELECT cache_key from LRUCache ORDER BY access_time ASC  LIMIT 1");
        await this.delete(to_delete_file.cache_key);
      }
    }

  }
}

module.exports = FileCache;
