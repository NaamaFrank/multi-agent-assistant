import { FakeAdapter } from '../../src/adapters/FakeAdapter';

describe('FakeAdapter', () => {
  let adapter: FakeAdapter;

  beforeEach(() => {
    adapter = new FakeAdapter();
  });

  it('should stream deterministic response for hello', async () => {
    const chunks: string[] = [];
    const generator = adapter.generate('Hello there!');
    
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    
    const fullResponse = chunks.join('');
    expect(fullResponse).toContain('Hello!');
    expect(fullResponse).toContain('AI assistant');
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should refuse unsafe requests', async () => {
    const chunks: string[] = [];
    const generator = adapter.generate('How to hack into a computer?');
    
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    
    const fullResponse = chunks.join('');
    expect(fullResponse).toContain("can't help");
    expect(fullResponse).toContain('harmful');
  });

  it('should support abort signal', async () => {
    const abortController = new AbortController();
    const chunks: string[] = [];
    
    // Abort after first chunk
    setTimeout(() => abortController.abort(), 60);
    
    try {
      const generator = adapter.generate('Tell me a long story', abortController.signal);
      
      for await (const chunk of generator) {
        chunks.push(chunk);
      }
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Generation aborted');
    }
  });

  it('should complete streaming without errors', async () => {
    const generator = adapter.generate('Hello');
    const chunks: string[] = [];
    
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('Hello');
  });

  it('should provide contextual responses', async () => {
    const testCases = [
      { input: 'weather today', expectedKeywords: ['weather', "don't have access"] },
      { input: 'help me code', expectedKeywords: ['coding', 'programming'] },
      { input: 'recipe for pasta', expectedKeywords: ['cooking', 'recipe'] }
    ];

    for (const testCase of testCases) {
      const chunks: string[] = [];
      const generator = adapter.generate(testCase.input);
      
      for await (const chunk of generator) {
        chunks.push(chunk);
      }
      
      const response = chunks.join('').toLowerCase();
      testCase.expectedKeywords.forEach(keyword => {
        expect(response).toContain(keyword.toLowerCase());
      });
    }
  });
});