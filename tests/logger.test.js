const logger = require('../src/utils/logger');

describe('Logger', () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;
  
  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
  
  test('should log info messages', () => {
    logger.info('Test message', { key: 'value' });
    expect(consoleLogSpy).toHaveBeenCalled();
    const logOutput = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Test message');
    expect(parsed.key).toBe('value');
  });
  
  test('should log error messages', () => {
    logger.error('Error message', { error: 'details' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    const logOutput = consoleErrorSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('Error message');
  });
  
  test('should log warn messages', () => {
    logger.warn('Warning message');
    expect(consoleWarnSpy).toHaveBeenCalled();
    const logOutput = consoleWarnSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.level).toBe('warn');
  });
  
  test('should include timestamp in logs', () => {
    logger.info('Test');
    const logOutput = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(logOutput);
    expect(parsed.timestamp).toBeDefined();
    expect(new Date(parsed.timestamp)).toBeInstanceOf(Date);
  });
});
