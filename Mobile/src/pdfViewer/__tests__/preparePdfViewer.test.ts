const mockDirectoryCreate = jest.fn();
const mockFileCreate = jest.fn();
const mockFileWrite = jest.fn();
const mockFileDelete = jest.fn();
const mockState: { directoryExists: boolean; fileExistsByName: Record<string, boolean> } = {
  directoryExists: false,
  fileExistsByName: {},
};

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = 'file:///cache/pdfjs-viewer/';
    }
    get exists() {
      return mockState.directoryExists;
    }
    create(...args: any[]) {
      mockDirectoryCreate(...args);
    }
  }

  class File {
    name: string;
    uri: string;
    constructor(...parts: any[]) {
      this.name = parts[parts.length - 1];
      this.uri = `file:///cache/pdfjs-viewer/${this.name}`;
    }
    get exists() {
      return !!mockState.fileExistsByName[this.name];
    }
    create(...args: any[]) {
      mockFileCreate(this.name, ...args);
      mockState.fileExistsByName[this.name] = true;
    }
    write(content: string, ...args: any[]) {
      mockFileWrite(this.name, content, ...args);
    }
    delete() {
      mockFileDelete(this.name);
      mockState.fileExistsByName[this.name] = false;
    }
  }

  return {
    Directory,
    File,
    Paths: { cache: 'CACHE_DIR' },
  };
});

import { preparePdfViewerAssets } from '../preparePdfViewer';

describe('preparePdfViewerAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.directoryExists = false;
    Object.keys(mockState.fileExistsByName).forEach((key) => delete mockState.fileExistsByName[key]);
  });

  it('creates the viewer directory when it does not exist', async () => {
    await preparePdfViewerAssets('file:///cache/team-rules-team1.pdf');

    expect(mockDirectoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ idempotent: true, intermediates: true }),
    );
  });

  it('writes pdf.min.js and pdf.worker.min.js only once (cached across calls)', async () => {
    await preparePdfViewerAssets('file:///cache/team-rules-team1.pdf');
    await preparePdfViewerAssets('file:///cache/team-rules-team2.pdf');

    const pdfJsWrites = mockFileWrite.mock.calls.filter(([name]) => name === 'pdf.min.js');
    const workerWrites = mockFileWrite.mock.calls.filter(([name]) => name === 'pdf.worker.min.js');
    expect(pdfJsWrites).toHaveLength(1);
    expect(workerWrites).toHaveLength(1);
  });

  it('always rewrites viewer.html so template updates always take effect', async () => {
    await preparePdfViewerAssets('file:///cache/team-rules-team1.pdf');
    await preparePdfViewerAssets('file:///cache/team-rules-team2.pdf');

    const htmlWrites = mockFileWrite.mock.calls.filter(([name]) => name === 'viewer.html');
    expect(htmlWrites).toHaveLength(2);
  });

  it('returns a viewer.html uri with the pdf file uri encoded as a query param', async () => {
    const result = await preparePdfViewerAssets('file:///cache/team-rules-team1.pdf');

    expect(result).toBe(
      'file:///cache/pdfjs-viewer/viewer.html?file=file%3A%2F%2F%2Fcache%2Fteam-rules-team1.pdf',
    );
  });
});
