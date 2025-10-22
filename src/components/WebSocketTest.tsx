import { useState } from 'react';
import { Button } from './ui/button';
import { testWebSocketConnection } from '../lib/websocket-test';
import { getWebSocketUrl } from '../lib/websocket';

export function WebSocketTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    
    const wsUrl = getWebSocketUrl();
    console.log('Testing WebSocket connection to:', wsUrl);
    
    const success = await testWebSocketConnection();
    
    setResult(success ? 'WebSocket connection successful!' : 'WebSocket connection failed');
    setTesting(false);
  };

  return (
    <div className="p-4 border border-slate-700 rounded-lg bg-slate-800">
      <h3 className="text-white text-lg mb-2">WebSocket Connection Test</h3>
      <p className="text-slate-400 text-sm mb-4">
        Test WebSocket connection to: {getWebSocketUrl()}
      </p>
      
      <Button 
        onClick={runTest} 
        disabled={testing}
        className="mb-2"
      >
        {testing ? 'Testing...' : 'Test Connection'}
      </Button>
      
      {result && (
        <div className={`text-sm p-2 rounded ${
          result.includes('successful') 
            ? 'bg-green-900 text-green-200' 
            : 'bg-red-900 text-red-200'
        }`}>
          {result}
        </div>
      )}
    </div>
  );
}