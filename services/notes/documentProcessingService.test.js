jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    execFile: jest.fn((cmd, args, cb) => {
      const err = new Error('pdftoppm not found');
      err.code = 'ENOENT';
      cb(err);
    })
  };
});

jest.mock('pdf-parse', () => jest.fn(async () => ({ text: '', numpages: 2 })));

const { DocumentProcessingService } = require('./documentProcessingService');

describe('DocumentProcessingService PDF fallback', () => {
  it('returns pdfParse metadata when PDF has no text and OCR tool missing', async () => {
    const service = new DocumentProcessingService({ tempDir: __dirname });
    const result = await service._extractPdfText(Buffer.from('fake-pdf'), `${__dirname}/fake.pdf`);
    expect(result).toBeTruthy();
    expect(result.text).toBe('');
    expect(result.pdfParse).toBeTruthy();
    expect(result.pdfParse.method).toBe('none');
    expect(result.pdfParse.reason).toBe('OCR_TOOL_NOT_AVAILABLE');
  });

  it('returns pdfParse metadata when pdf-parse throws', async () => {
    const pdfParse = require('pdf-parse');
    pdfParse.mockImplementationOnce(async () => {
      throw new Error('bad pdf');
    });

    const service = new DocumentProcessingService({ tempDir: __dirname });
    const result = await service._extractPdfText(Buffer.from('fake-pdf'), `${__dirname}/fake.pdf`);
    expect(result.text).toBe('');
    expect(result.pdfParse.method).toBe('none');
    expect(String(result.pdfParse.reason)).toContain('PDF_PARSE_ERROR:bad pdf');
  });
});
