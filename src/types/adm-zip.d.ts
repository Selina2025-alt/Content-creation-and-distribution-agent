declare module "adm-zip" {
  export interface IZipEntry {
    entryName: string;
    getData(): Buffer;
  }

  export default class AdmZip {
    constructor(buffer?: Buffer | string);
    addFile(entryName: string, content: Buffer): void;
    extractAllTo(targetPath: string, overwrite?: boolean): void;
    getEntries(): IZipEntry[];
    toBuffer(): Buffer;
  }
}
