import { ToolRegistry } from '../../src/tools/ToolRegistry';
import { Tool, ToolSchema, ToolResult } from '../../src/types';

// Create a mock tool for testing
class MockTool implements Tool {
  name = 'mock_tool';
  
  schema(): ToolSchema {
    return {
      name: this.name,
      description: 'A mock tool for testing',
      input_schema: {
        type: 'object',
        properties: {
          value: { type: 'string' }
        }
      }
    };
  }
  
  async execute(input: any): Promise<ToolResult> {
    if (input.throwError) {
      throw new Error('Mock tool error');
    }
    return {
      tool_use_id: '',
      content: { result: `Processed: ${input.value}` }
    };
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockTool: MockTool;
  
  beforeEach(() => {
    registry = new ToolRegistry();
    mockTool = new MockTool();
    registry.register(mockTool);
  });
  
  test('should register tools', () => {
    const schemas = registry.getSchemas();
    
    expect(schemas).toHaveLength(1);
    expect(schemas[0].name).toBe('mock_tool');
    expect(schemas[0].description).toBe('A mock tool for testing');
  });
  
  test('should execute a registered tool', async () => {
    const result = await registry.execute({
      id: 'test-id-123',
      name: 'mock_tool',
      input: { value: 'test input' }
    });
    
    expect(result.tool_use_id).toBe('test-id-123');
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual({ result: 'Processed: test input' });
  });
  
  test('should handle unknown tools', async () => {
    const result = await registry.execute({
      id: 'test-id-456',
      name: 'unknown_tool',
      input: {}
    });
    
    expect(result.tool_use_id).toBe('test-id-456');
    expect(result.isError).toBe(true);
    expect(result.content).toEqual({ error: 'Unknown tool: unknown_tool' });
  });
  
  test('should handle tool execution errors', async () => {
    const result = await registry.execute({
      id: 'test-id-789',
      name: 'mock_tool',
      input: { throwError: true }
    });
    
    expect(result.tool_use_id).toBe('test-id-789');
    expect(result.isError).toBe(true);
    expect(result.content).toEqual({ error: 'Error: Mock tool error' });
  });
});