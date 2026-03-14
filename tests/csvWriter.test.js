const fs = require('fs');
const path = require('path');
const { writeCSV } = require('../src/utils/csvWriter');

describe('CSV Writer', () => {
  const testOutputDir = './test-output';
  
  beforeAll(() => {
    process.env.OUTPUT_DIR = testOutputDir;
  });
  
  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testOutputDir)) {
      const files = fs.readdirSync(testOutputDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testOutputDir, file));
      });
      fs.rmdirSync(testOutputDir);
    }
  });
  
  test('should create output directory if it does not exist', async () => {
    const filename = 'test.csv';
    const headers = ['col1', 'col2'];
    const rows = [{ col1: 'val1', col2: 'val2' }];
    
    await writeCSV(filename, headers, rows);
    
    expect(fs.existsSync(testOutputDir)).toBe(true);
  });
  
  test('should write CSV file with headers and data', async () => {
    const filename = 'test.csv';
    const headers = ['id', 'name', 'email'];
    const rows = [
      { id: 1, name: 'John', email: 'john@example.com' },
      { id: 2, name: 'Jane', email: 'jane@example.com' },
    ];
    
    await writeCSV(filename, headers, rows);
    
    const filePath = path.join(testOutputDir, filename);
    expect(fs.existsSync(filePath)).toBe(true);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines[0]).toBe('id,name,email');
    expect(lines[1]).toBe('1,John,john@example.com');
    expect(lines[2]).toBe('2,Jane,jane@example.com');
  });
  
  test('should handle empty values', async () => {
    const filename = 'test.csv';
    const headers = ['id', 'name', 'value'];
    const rows = [
      { id: 1, name: 'Test', value: null },
      { id: 2, name: 'Test2', value: undefined },
    ];
    
    await writeCSV(filename, headers, rows);
    
    const filePath = path.join(testOutputDir, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines[1]).toBe('1,Test,');
    expect(lines[2]).toBe('2,Test2,');
  });
  
  test('should escape values with commas', async () => {
    const filename = 'test.csv';
    const headers = ['id', 'description'];
    const rows = [
      { id: 1, description: 'This, has, commas' },
    ];
    
    await writeCSV(filename, headers, rows);
    
    const filePath = path.join(testOutputDir, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines[1]).toBe('1,"This, has, commas"');
  });
  
  test('should escape values with quotes', async () => {
    const filename = 'test.csv';
    const headers = ['id', 'text'];
    const rows = [
      { id: 1, text: 'He said "hello"' },
    ];
    
    await writeCSV(filename, headers, rows);
    
    const filePath = path.join(testOutputDir, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines[1]).toBe('1,"He said ""hello"""');
  });
});
