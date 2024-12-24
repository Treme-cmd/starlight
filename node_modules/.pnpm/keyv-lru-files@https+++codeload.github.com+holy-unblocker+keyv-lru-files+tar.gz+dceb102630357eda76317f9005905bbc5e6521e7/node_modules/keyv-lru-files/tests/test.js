process.env.NODE_ENV = "test";
const lrufiles = require("../src/index");
const fs = require("fs");

describe("store / get / delete string in cache", () => {
  const cache = new lrufiles({
    dir: "cache", // directory to store caches files
    files: 3, // maximum number of files
    size: "1 GB", // maximum total file size
  });

  test('store string to cache', async () => {
    let resp = await cache.set("key", "sample_value_2");
    expect(resp.endsWith("key")).toBe(true);
  });

  test('store object to cache', async () => {
    let resp = await cache.set("key", {
      "success": true
    });
    expect(resp.endsWith("key")).toBe(true);
  });

  test('store stream to cache', async () => {
    let resp = await cache.set("key", fs.createReadStream("./LICENSE"));
    expect(resp.endsWith("key")).toBe(true);
  });

  test('overwrite existing cache', async () => {
    let resp = await cache.set("key", "sample_value");
    expect(resp.endsWith("key")).toBe(true);
  });

  test('get string from cache', async () => {
    let value = await cache.get("key");
    expect(value.toString("utf-8")).toBe("sample_value");
  });

  test('stream string from cache', async () => {
    let stream = await cache.stream("key");

    let bufs = [];
    stream.on("end", () => {
      expect(Buffer.concat(bufs).toString("utf-8")).toBe("sample_value");
    });
    stream.on("data", (chunk) => {
      bufs.push(chunk);
    });
  });

  test('update file access time', async () => {
    let resp = await cache.touch("key");
    expect(resp).toBe(true);
  });

  test('delete key from cache', async () => {
    let value = await cache.delete("key");
    expect(value).toBe(true);
    let exists = await cache.has("key");
    expect(exists).toBe(false);
  });
});


describe("set two buffers and clear entire cache", () => {
  const cache = new lrufiles({
    dir: "cache", // directory to store caches files
    files: 3, // maximum number of files
    size: "1 GB", // maximum total file size
  });

  test('store first buffer to cache', async () => {
    let resp = await cache.set("buf1", Buffer.from("sample_1"));
    expect(resp.endsWith("buf1")).toBe(true);
  });

  test('store second buffer to cache', async () => {
    let resp = await cache.set("buf2", Buffer.from("sample_2"));
    expect(resp.endsWith("buf2")).toBe(true);
  });

  test('clear entire cache', async () => {
    let resp = await cache.clear();
    expect(true).toBe(true);

    let keys = await cache.keys();
    expect(keys.length).toBe(0);
  });
});


describe("non-existent cache operations", () => {
  const cache = new lrufiles({
    dir: "cache", // directory to store caches files
    files: 3, // maximum number of files
    size: "1 GB", // maximum total file size
  });

  test('setting / as cache key to check errror', async () => {
    await expect(cache.set("/", "something")).rejects.toThrow("'/' is not supported character as key.")
  });

  test('trying to get non-existent cache key', async () => {
    let resp = await cache.get("does_not_exist");
    expect(resp).toBe(undefined);
  });

  test('trying to stream non-existent cache key', async () => {
    let resp = await cache.stream("does_not_exist");
    expect(resp).toBe(undefined);
  });

  test('trying to delete non-existent cache key', async () => {
    let resp = await cache.delete("does_not_exist");
    expect(resp).toBe(false);
  });

  test('checking for non-existent key', async () => {
    let resp = await cache.has("does_not_exist");
    expect(resp).toBe(false);
  });

  test('touching non-existent key', async () => {
    await expect(cache.touch("dows_not_exist")).rejects.toThrow('KEY_NOT_FOUND');
  });
});

describe("write many files and check stale cache cleaner for number of files", () => {
  const bigcache = new lrufiles({
    dir: "bigcache", // directory to store caches files
    files: 3, // maximum number of files
    size: 120, // maximum total file size
  });

  test('write 5 files', async () => {
    await bigcache.set("file1", "value1");
    await bigcache.set("file2", "value2");
    await bigcache.set("file3", "value3");
    await bigcache.set("file4", "value4");
    await bigcache.set("file5", "value5");
    let keys = await bigcache.keys();
    expect(keys.length).toBe(3);
  });

});

describe("write many files and check stale cache cleaner for number of bytes", () => {
  const bigcache = new lrufiles({
    dir: "byte_cache", // directory to store caches files
    files: null, // maximum number of files
    size: 12, // maximum total file size
  });

  test('write 5 files', async () => {
    await bigcache.set("file1", "value1");
    await bigcache.set("file2", "value2");
    await bigcache.set("file3", "value3");
    await bigcache.set("file4", "value4");
    await bigcache.set("file5", "value5");
    let keys = await bigcache.keys();
    expect(keys.length).toBe(2);
  });

});
