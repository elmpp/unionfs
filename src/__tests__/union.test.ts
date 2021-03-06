import { Union } from '..';
import { Volume, createFsFromVolume } from 'memfs';
import * as fs from 'fs';
import { isMainThread } from 'worker_threads';

describe('union', () => {
  describe('Union', () => {
    describe('sync methods', () => {
      it('Basic one file system', () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const ufs = new Union();
        ufs.use(vol as any);
        expect(ufs.readFileSync('/foo', 'utf8')).toBe('bar');
      });

      it('basic two filesystems', () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const vol2 = Volume.fromJSON({ '/foo': 'baz' });
        const ufs = new Union();
        ufs.use(vol as any);
        ufs.use(vol2 as any);

        expect(ufs.readFileSync('/foo', 'utf8')).toBe('baz');
      });

      it('File not found', () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const ufs = new Union();
        ufs.use(vol as any);
        try {
          ufs.readFileSync('/not-found', 'utf8');
          throw Error('This should not throw');
        } catch (err) {
          expect(err.code).toBe('ENOENT');
        }
      });

      it('Method does not exist', () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const ufs = new Union();
        vol.readFileSync = undefined as any;
        ufs.use(vol as any);
        try {
          ufs.readFileSync('/foo', 'utf8');
          throw Error('not_this');
        } catch (err) {
          expect(err.message).not.toBe('not_this');
        }
      });

      describe('watch()', () => {
        it('should create a watcher', () => {
          const ufs = new Union().use(Volume.fromJSON({ 'foo.js': 'hello test' }, '/tmp') as any);

          const mockCallback = jest.fn();
          const writtenContent = 'hello world';
          const watcher = ufs.watch('/tmp/foo.js', mockCallback);

          ufs.writeFileSync('/tmp/foo.js', writtenContent);

          expect(mockCallback).toBeCalledTimes(2);
          expect(mockCallback).toBeCalledWith('change', '/tmp/foo.js');

          watcher.close();
        });
      });

      describe('existsSync()', () => {
        it('finds file on real file system', () => {
          const ufs = new Union();

          ufs.use(fs).use(Volume.fromJSON({ 'foo.js': '' }, '/tmp') as any);

          expect(ufs.existsSync(__filename)).toBe(true);
          expect(fs.existsSync(__filename)).toBe(true);
          expect(ufs.existsSync('/tmp/foo.js')).toBe(true);
        });
      });

      describe('when none of the volumes are readable', () => {
        it('throws an error when calling a read method', () => {
          const vol1 = Volume.fromJSON({ '/foo': 'bar1' });
          const vol2 = Volume.fromJSON({ '/foo': 'bar2' });
          const ufs = new Union();
          ufs.use(vol1 as any, { readable: false }).use(vol2 as any, { readable: false });

          expect(() => ufs.readFileSync('/foo')).toThrowError();
        });
      });

      describe('when none of the volumes are writable', () => {
        it('throws an error when calling a write method', () => {
          const vol1 = Volume.fromJSON({ '/foo': 'bar' });
          const vol2 = Volume.fromJSON({ '/foo': 'bar' });
          const ufs = new Union();
          ufs.use(vol1 as any, { writable: false }).use(vol2 as any, { writable: false });

          expect(() => ufs.writeFileSync('/foo', 'bar')).toThrowError();
        });
      });

      describe('readable/writable', () => {
        it('writes to the last vol added', () => {
          const vol1 = Volume.fromJSON({});
          const vol2 = Volume.fromJSON({});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any);
          ufs.writeFileSync('/foo', 'bar');

          expect(vol2.readFileSync('/foo', 'utf8')).toEqual('bar');
        });

        it('writes to the last vol added', () => {
          const vol1 = Volume.fromJSON({});
          const vol2 = Volume.fromJSON({});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any, { readable: false });
          ufs.writeFileSync('/foo', 'bar');

          expect(vol2.readFileSync('/foo', 'utf8')).toEqual('bar');
        });

        it('reads from the last vol added', () => {
          const vol1 = Volume.fromJSON({'/foo': 'bar'});
          const vol2 = Volume.fromJSON({'/foo': 'bar2'});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any);

          expect(ufs.readFileSync('/foo', 'utf8')).toEqual('bar2');
        });

        it('reads from the latest added readable vol', () => {
          const vol1 = Volume.fromJSON({'/foo': 'bar'});
          const vol2 = Volume.fromJSON({});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any, { readable: false });

          expect(ufs.readFileSync('/foo', 'utf8')).toEqual('bar');
        });
      });

      describe('readdirSync', () => {
        it('reads one memfs correctly', () => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/baz': 'baz',
          });
          const ufs = new Union();
          ufs.use(vol as any);
          expect(ufs.readdirSync('/foo')).toEqual(['bar', 'baz']);
        });

        it('reads multiple memfs', () => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/baz': 'baz',
          });
          const vol2 = Volume.fromJSON({
            '/foo/qux': 'baz',
          });

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.use(vol2 as any);
          expect(ufs.readdirSync('/foo')).toEqual(['bar', 'baz', 'qux']);
        });

        it('reads dedupes multiple fss', () => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/baz': 'baz',
          });
          const vol2 = Volume.fromJSON({
            '/foo/baz': 'not baz',
            '/foo/qux': 'baz',
          });

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.use(vol2 as any);
          expect(ufs.readdirSync('/foo')).toEqual(['bar', 'baz', 'qux']);
        });

        it('reads other fss when one fails', () => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/baz': 'baz',
          });
          const vol2 = Volume.fromJSON({
            '/bar/baz': 'not baz',
            '/bar/qux': 'baz',
          });

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.use(vol2 as any);
          expect(ufs.readdirSync('/bar')).toEqual(['baz', 'qux']);
        });

        it('honors the withFileTypes: true option', () => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/zzz': 'zzz',
            '/foo/baz': 'baz',
          });

          const ufs = new Union();
          ufs.use(vol as any);
          const files = ufs.readdirSync('/foo', { withFileTypes: true });
          expect(files[0]).toBeInstanceOf(createFsFromVolume(vol).Dirent);
          expect(files.map(f => f.name)).toEqual(['bar', 'baz', 'zzz']);
        });

        it('throws an error when all fss fail', () => {
          const vol = Volume.fromJSON({});
          const vol2 = Volume.fromJSON({});

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.use(vol2 as any);
          expect(() => ufs.readdirSync('/bar')).toThrow();
        });
      });
    });
    describe('async methods', () => {
      it('Basic one file system', done => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const ufs = new Union();
        ufs.use(vol as any);
        ufs.readFile('/foo', 'utf8', (err, data) => {
          expect(err).toBe(null);
          expect(data).toBe('bar');
          done();
        });
      });
      it('basic two filesystems', () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const vol2 = Volume.fromJSON({ '/foo': 'baz' });
        const ufs = new Union();
        ufs.use(vol as any);
        ufs.use(vol2 as any);
        ufs.readFile('/foo', 'utf8', (err, content) => {
          expect(content).toBe('baz');
        });
      });
      it('File not found', done => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const ufs = new Union();
        ufs.use(vol as any);
        ufs.readFile('/not-found', 'utf8', (err, data) => {
          expect(err?.code).toBe('ENOENT');
          done();
        });
      });

      it('No callback provided', () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const ufs = new Union();
        ufs.use(vol as any);
        try {
          ufs.stat('/foo2', undefined as any);
        } catch (err) {
          expect(err).toBeInstanceOf(TypeError);
        }
      });

      it('No file systems attached', done => {
        const ufs = new Union();
        ufs.stat('/foo2', (err, data) => {
          expect(err?.message).toBe('No file systems attached.');
          done();
        });
      });

      it('callbacks are only called once', done => {
        const vol = Volume.fromJSON({
          '/foo/bar': 'bar',
        });
        const vol2 = Volume.fromJSON({
          '/foo/bar': 'baz',
        });

        const ufs = new Union();
        ufs.use(vol as any);
        ufs.use(vol2 as any);

        const mockCallback = jest.fn();
        ufs.readFile('/foo/bar', 'utf8', () => {
          mockCallback();
          expect(mockCallback).toBeCalledTimes(1);
          done();
        });
      });

      describe('when none of the volumes are readable', () => {
        it('throws an error when calling a read method', done => {
          const vol1 = Volume.fromJSON({ '/foo': 'bar1' });
          const vol2 = Volume.fromJSON({ '/foo': 'bar2' });
          const ufs = new Union();
          ufs.use(vol1 as any, { readable: false }).use(vol2 as any, { readable: false });

          ufs.readFile('/foo', 'utf8', (err, res) => {
            expect(err).toBeInstanceOf(Error);
            done();
          });
        });
      });

      describe('when none of the volumes are writable', () => {
        it('throws an error when calling a write method', done => {
          const vol1 = Volume.fromJSON({ '/foo': 'bar' });
          const vol2 = Volume.fromJSON({ '/foo': 'bar' });
          const ufs = new Union();
          ufs.use(vol1 as any, { writable: false }).use(vol2 as any, { writable: false });
          ufs.writeFile('/foo', 'bar', (err) => {
            expect(err).toBeInstanceOf(Error);
            done();
          });
        });
      });

      describe('readable/writable', () => {
        it('writes to the last vol added', done => {
          const vol1 = Volume.fromJSON({});
          const vol2 = Volume.fromJSON({});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any);
          ufs.writeFile('/foo', 'bar', (err) => {
            vol2.readFile('/foo', 'utf8', (err, res) => {
              expect(res).toEqual('bar');
              done();
            });
          });
        });

        it('writes to the latest added writable vol', done => {
          const vol1 = Volume.fromJSON({});
          const vol2 = Volume.fromJSON({});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any, {writable: false});
          ufs.writeFile('/foo', 'bar', (err) => {
            ufs.readFile('/foo', 'utf8', (err, res) => {
              expect(res).toEqual('bar');
              vol1.readFile('/foo', 'utf8', (err, res) => {
                expect(res).toEqual('bar');
                done();
              });
            });
          });
        });

        it('reads from the last vol added', done => {
          const vol1 = Volume.fromJSON({'/foo': 'bar'});
          const vol2 = Volume.fromJSON({'/foo': 'bar2'});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any);
          ufs.readFile('/foo', 'utf8', (err, res) => {
            expect(res).toEqual('bar2');
            done();
          });

        })

        it('reads from the latest added readable vol', done => {
          const vol1 = Volume.fromJSON({'/foo': 'bar'});
          const vol2 = Volume.fromJSON({'/foo': 'bar2'});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any, {readable: false});
          ufs.readFile('/foo', 'utf8', (err, res) => {
            expect(res).toEqual('bar');
            done();
          });
        })
      });

      describe('readdir', () => {
        it('reads one memfs correctly', () => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/baz': 'baz',
          });
          const ufs = new Union();
          ufs.use(vol as any);
          ufs.readdir('/foo', (err, files) => {
            expect(files).toEqual(['bar', 'baz']);
          });
        });

        it('reads multiple memfs correctly', done => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/baz': 'baz',
          });
          const vol2 = Volume.fromJSON({
            '/foo/qux': 'baz',
          });

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.use(vol2 as any);
          ufs.readdir('/foo', (err, files) => {
            expect(err).toBeNull();
            expect(files).toEqual(['bar', 'baz', 'qux']);
            done();
          });
        });

        it('reads other fss when one fails', done => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/baz': 'baz',
          });
          const vol2 = Volume.fromJSON({
            '/bar/baz': 'not baz',
            '/bar/qux': 'baz',
          });

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.use(vol2 as any);
          ufs.readdir('/bar', (err, files) => {
            expect(err).toBeNull();
            expect(files).toEqual(['baz', 'qux']);
            done();
          });
        });

        it('honors the withFileTypes: true option', done => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/zzz': 'zzz',
            '/foo/baz': 'baz',
          });

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.readdir('/foo', { withFileTypes: true }, (err, files) => {
            expect(files[0]).toBeInstanceOf(createFsFromVolume(vol).Dirent);
            expect(files.map(f => f.name)).toEqual(['bar', 'baz', 'zzz']);
            done();
          });
        });

        it('throws an error when all fss fail', done => {
          const vol = Volume.fromJSON({});
          const vol2 = Volume.fromJSON({});

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.use(vol2 as any);
          ufs.readdir('/bar', (err, files) => {
            expect(err).not.toBeNull();
            done();
          });
        });
      });
    });
    describe('promise methods', () => {
      it('Basic one file system', async () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const ufs = new Union();
        ufs.use(vol as any);
        await expect(ufs.promises.readFile('/foo', 'utf8')).resolves.toBe('bar');
      });

      it('basic two filesystems', async () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const vol2 = Volume.fromJSON({ '/foo': 'baz' });
        const ufs = new Union();
        ufs.use(vol as any);
        ufs.use(vol2 as any);

        await expect(ufs.promises.readFile('/foo', 'utf8')).resolves.toBe('baz');
      });

      it('File not found', async () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const ufs = new Union();
        ufs.use(vol as any);
        await expect(ufs.promises.readFile('/not-found', 'utf8')).rejects.toThrowError('ENOENT');
      });

      it('Method does not exist', async () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const ufs = new Union();
        vol.promises.readFile = undefined as any;
        ufs.use(vol as any);
        await expect(ufs.promises.readFile('/foo', 'utf8')).rejects.toThrowError();
      });

      describe('when none of the volumes are readable', () => {
        it('throws an error when calling a read method', async () => {
          const vol1 = Volume.fromJSON({ '/foo': 'bar1' });
          const vol2 = Volume.fromJSON({ '/foo': 'bar2' });
          const ufs = new Union();
          ufs.use(vol1 as any, { readable: false }).use(vol2 as any, { readable: false });

          await expect(ufs.promises.readFile('/foo')).rejects.toThrowError();
        });
      });

      describe('when none of the volumes are writable', () => {
        it('throws an error when calling a write method', async () => {
          const vol1 = Volume.fromJSON({ '/foo': 'bar' });
          const vol2 = Volume.fromJSON({ '/foo': 'bar' });
          const ufs = new Union();
          ufs.use(vol1 as any, { writable: false }).use(vol2 as any, { writable: false });

          await expect(ufs.promises.writeFile('/foo', 'bar')).rejects.toThrowError();
        });
      });

      describe('readable/writable', () => {
        it('writes to the last vol added', async () => {
          const vol1 = Volume.fromJSON({});
          const vol2 = Volume.fromJSON({});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any);
          ufs.writeFileSync('/foo', 'bar');
          await expect(vol2.promises.readFile('/foo', 'utf8')).resolves.toEqual('bar');
        });

        it('writes to the latest added writable vol', async () => {
          const vol1 = Volume.fromJSON({});
          const vol2 = Volume.fromJSON({});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any, { writable: false });
          ufs.writeFileSync('/foo', 'bar');
          await expect(vol1.promises.readFile('/foo', 'utf8')).resolves.toEqual('bar');
        });

        it('reads from the last vol added', async () => {
          const vol1 = Volume.fromJSON({'/foo': 'bar'});
          const vol2 = Volume.fromJSON({'/foo': 'bar2'});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any);
          await expect(ufs.promises.readFile('/foo', 'utf8')).resolves.toEqual('bar2');

        })

        it('reads from the latest added readable vol', async () => {
          const vol1 = Volume.fromJSON({'/foo': 'bar'});
          const vol2 = Volume.fromJSON({'/foo': 'bar2'});
          const ufs = new Union();
          ufs.use(vol1 as any).use(vol2 as any, {readable: false});
          await expect(ufs.promises.readFile('/foo', 'utf8')).resolves.toEqual('bar');
        })
      });

      describe('readdir', () => {
        it('reads one memfs correctly', async () => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/baz': 'baz',
          });
          const ufs = new Union();
          ufs.use(vol as any);
          await expect(ufs.promises.readdir('/foo')).resolves.toEqual(['bar', 'baz']);
        });

        it('reads multiple memfs', async () => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/baz': 'baz',
          });
          const vol2 = Volume.fromJSON({
            '/foo/qux': 'baz',
          });

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.use(vol2 as any);
          await expect(ufs.promises.readdir('/foo')).resolves.toEqual(['bar', 'baz', 'qux']);
        });

        it('reads dedupes multiple fss', async () => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/baz': 'baz',
          });
          const vol2 = Volume.fromJSON({
            '/foo/baz': 'not baz',
            '/foo/qux': 'baz',
          });

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.use(vol2 as any);
          await expect(ufs.promises.readdir('/foo')).resolves.toEqual(['bar', 'baz', 'qux']);
        });

        it('reads other fss when one fails', async () => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/baz': 'baz',
          });
          const vol2 = Volume.fromJSON({
            '/bar/baz': 'not baz',
            '/bar/qux': 'baz',
          });

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.use(vol2 as any);
          await expect(ufs.promises.readdir('/bar')).resolves.toEqual(['baz', 'qux']);
        });

        it('honors the withFileTypes: true option', async () => {
          const vol = Volume.fromJSON({
            '/foo/bar': 'bar',
            '/foo/zzz': 'zzz',
            '/foo/baz': 'baz',
          });

          const ufs = new Union();
          ufs.use(vol as any);
          const files = await ufs.promises.readdir('/foo', { withFileTypes: true });
          expect(files[0]).toBeInstanceOf(createFsFromVolume(vol).Dirent);
          expect(files.map(f => f.name)).toEqual(['bar', 'baz', 'zzz']);
        });

        it('throws an error when all fss fail', async () => {
          const vol = Volume.fromJSON({});
          const vol2 = Volume.fromJSON({});

          const ufs = new Union();
          ufs.use(vol as any);
          ufs.use(vol2 as any);
          await expect(ufs.promises.readdir('/bar')).rejects.toThrow();
        });
      });
    });

    describe('Streams', () => {
      it('can create Readable Streams', () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const ufs = new Union();

        ufs.use(vol as any).use(fs);

        expect(ufs.createReadStream).toBeInstanceOf(Function);
        expect(vol.createReadStream('/foo')).toHaveProperty('_readableState');
        expect(fs.createReadStream(__filename)).toHaveProperty('_readableState');

        expect(ufs.createReadStream('/foo')).toHaveProperty('_readableState');
        expect(ufs.createReadStream(__filename)).toHaveProperty('_readableState');
      });

      it('can create Writable Streams', () => {
        const vol = Volume.fromJSON({ '/foo': 'bar' });
        const ufs = new Union();
        const realFile = __filename + '.test';
        ufs.use(vol as any).use(fs);

        expect(ufs.createWriteStream).toBeInstanceOf(Function);
        expect(vol.createWriteStream('/foo')).toHaveProperty('_writableState');
        expect(fs.createWriteStream(realFile)).toHaveProperty('_writableState');

        expect(ufs.createWriteStream('/foo')).toHaveProperty('_writableState');
        expect(ufs.createWriteStream(realFile)).toHaveProperty('_writableState');

        ufs.unlinkSync(realFile);
      });
    });
  });
});
