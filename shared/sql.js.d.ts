declare module 'sql.js' {
  export interface SqlValue {
    [key: string]: string | number | null | Uint8Array;
  }

  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }

  export class Statement {
    bind(values?: unknown[]): boolean;
    step(): boolean;
    get(): unknown[];
    getAsObject(): Record<string, unknown>;
    free(): void;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface InitSqlJsStatic {
    Database: typeof Database;
  }

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string;
    wasmBinary?: Buffer | ArrayBuffer | Uint8Array;
  }

  export default function initSqlJs(config?: InitSqlJsConfig): Promise<InitSqlJsStatic>;
}
