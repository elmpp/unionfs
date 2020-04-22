export const fsSyncMethodsWrite = [
  'appendFileSync',
  'chmodSync',
  'chownSync',
  'closeSync',
  'copyFileSync',
  'createWriteStream',
  'fchmodSync',
  'fchownSync',
  'fdatasyncSync',
  'fsyncSync',
  'futimesSync',
  'lchmodSync',
  'lchownSync',
  'linkSync',
  'lstatSync',
  'mkdirSync',
  'mkdtempSync',
  'renameSync',
  'rmdirSync',
  'symlinkSync',
  'truncateSync',
  'unlinkSync',
  'utimesSync',
  'writeFileSync',
  'writeSync',
] as const;

export const fsSyncMethodsRead = [
  'accessSync',
  'createReadStream',
  'existsSync',
  'fstatSync',
  'ftruncateSync',
  'openSync',
  'readdirSync',
  'readFileSync',
  'readlinkSync',
  'readSync',
  'realpathSync',
  'statSync',
] as const;
export const fsAsyncMethodsRead = [
  'access',
  'exists',
  'fstat',
  'open',
  'read',
  'readdir',
  'readFile',
  'readlink',
  'realpath',
  'unwatchFile',
  'watch',
  'watchFile',
] as const;
export const fsAsyncMethodsWrite = [
  'appendFile',
  'chmod',
  'chown',
  'close',
  'copyFile',
  'fchmod',
  'fchown',
  'fdatasync',
  'fsync',
  'ftruncate',
  'futimes',
  'lchmod',
  'lchown',
  'link',
  'lstat',
  'mkdir',
  'mkdtemp',
  'rename',
  'rmdir',
  'stat',
  'symlink',
  'truncate',
  'unlink',
  'utimes',
  'write',
  'writeFile',
] as const;

export const fsPromiseMethodsRead = [
  'access',
  'open',
  'readdir',
  'readFile',
  'readlink',
  'realpath',
] as const;

export const fsPromiseMethodsWrite = [
  'appendFile',
  'chmod',
  'chown',
  'copyFile',
  'lchmod',
  'lchown',
  'link',
  'lstat',
  'mkdir',
  'mkdtemp',
  'rename',
  'rmdir',
  'stat',
  'symlink',
  'truncate',
  'unlink',
  'utimes',
  'writeFile',
] as const;
