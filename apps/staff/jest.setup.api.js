/**
 * Jest setup for API route tests
 * Mocks Next.js server environment
 */

// Mock fetch globally for tests
global.fetch = jest.fn();

// Mock Next.js Request
global.Request = class Request {
  constructor(url, init) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new Map(Object.entries(init?.headers || {}));
    this._body = init?.body;
  }

  async json() {
    return JSON.parse(this._body);
  }
};

// Mock Next.js Response  
global.Response = class Response {
  constructor(body, init) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = new Map(Object.entries(init?.headers || {}));
  }

  async json() {
    return JSON.parse(this.body);
  }
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
