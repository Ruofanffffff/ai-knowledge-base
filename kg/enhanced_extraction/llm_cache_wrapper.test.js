/**
 * Unit Tests for LLMCacheWrapper
 * 
 * Tests cache integration, hit/miss behavior, and configuration
 */

const { LLMCacheWrapper, createCacheWrapper } = require('./llm_cache_wrapper');
const llmCache = require('../utils/llm_cache');

// Mock the llm_cache module
jest.mock('../utils/llm_cache');

describe('LLMCacheWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    llmCache.configure = jest.fn();
    llmCache.get = jest.fn();
    llmCache.set = jest.fn();
    llmCache.has = jest.fn();
    llmCache.invalidate = jest.fn();
    llmCache.invalidateByTags = jest.fn();
    llmCache.clear = jest.fn();
    llmCache.getStats = jest.fn();
    llmCache.getHealthMetrics = jest.fn();
    llmCache.optimize = jest.fn();
  });

  describe('Constructor', () => {
    it('should create wrapper with default config', () => {
      const wrapper = new LLMCacheWrapper();
      
      expect(wrapper.config.enabled).toBe(true);
      expect(wrapper.config.ttl).toBe(24 * 60 * 60 * 1000);
      expect(wrapper.config.maxSize).toBe(1000);
    });

    it('should create wrapper with custom config', () => {
      const wrapper = new LLMCacheWrapper({
        enabled: true,
        ttl: 3600000,
        maxSize: 500
      });
      
      expect(wrapper.config.ttl).toBe(3600000);
      expect(wrapper.config.maxSize).toBe(500);
    });

    it('should configure underlying cache when enabled', () => {
      new LLMCacheWrapper({ enabled: true });
      
      expect(llmCache.configure).toHaveBeenCalledWith({
        defaultTTL: 24 * 60 * 60 * 1000,
        maxSize: 1000,
        enableAutoCleanup: true,
        enableContentTracking: true
      });
    });

    it('should not configure cache when disabled', () => {
      new LLMCacheWrapper({ enabled: false });
      
      expect(llmCache.configure).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should get cached response when enabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: true });
      const mockResponse = { content: 'cached', tokens: 100 };
      
      llmCache.get.mockReturnValue(mockResponse);

      const result = wrapper.get('test prompt', { model: 'qwen' });

      expect(result).toEqual(mockResponse);
      expect(llmCache.get).toHaveBeenCalledWith('test prompt', { model: 'qwen' });
    });

    it('should return null when cache disabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: false });
      
      const result = wrapper.get('test prompt');

      expect(result).toBeNull();
      expect(llmCache.get).not.toHaveBeenCalled();
    });

    it('should return null on cache miss', () => {
      const wrapper = new LLMCacheWrapper({ enabled: true });
      
      llmCache.get.mockReturnValue(null);

      const result = wrapper.get('test prompt');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set cached response when enabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: true, ttl: 3600000 });
      const response = { content: 'test', tokens: 100 };
      
      llmCache.set.mockReturnValue('cache-key-123');

      const key = wrapper.set('test prompt', { model: 'qwen' }, response, ['tag1']);

      expect(key).toBe('cache-key-123');
      expect(llmCache.set).toHaveBeenCalledWith(
        'test prompt',
        { model: 'qwen' },
        response,
        3600000,
        ['tag1']
      );
    });

    it('should return null when cache disabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: false });
      const response = { content: 'test', tokens: 100 };

      const key = wrapper.set('test prompt', {}, response);

      expect(key).toBeNull();
      expect(llmCache.set).not.toHaveBeenCalled();
    });
  });

  describe('has', () => {
    it('should check if prompt is cached when enabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: true });
      
      llmCache.has.mockReturnValue(true);

      const result = wrapper.has('test prompt');

      expect(result).toBe(true);
      expect(llmCache.has).toHaveBeenCalledWith('test prompt', {});
    });

    it('should return false when cache disabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: false });

      const result = wrapper.has('test prompt');

      expect(result).toBe(false);
      expect(llmCache.has).not.toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    it('should invalidate cache entry when enabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: true });
      
      llmCache.invalidate.mockReturnValue(true);

      const result = wrapper.invalidate('test prompt');

      expect(result).toBe(true);
      expect(llmCache.invalidate).toHaveBeenCalledWith('test prompt', {});
    });

    it('should return false when cache disabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: false });

      const result = wrapper.invalidate('test prompt');

      expect(result).toBe(false);
      expect(llmCache.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('invalidateByTags', () => {
    it('should invalidate by tags when enabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: true });
      
      llmCache.invalidateByTags.mockReturnValue(5);

      const result = wrapper.invalidateByTags(['tag1', 'tag2']);

      expect(result).toBe(5);
      expect(llmCache.invalidateByTags).toHaveBeenCalledWith(['tag1', 'tag2']);
    });

    it('should return 0 when cache disabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: false });

      const result = wrapper.invalidateByTags(['tag1']);

      expect(result).toBe(0);
      expect(llmCache.invalidateByTags).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', () => {
      const wrapper = new LLMCacheWrapper();
      
      llmCache.clear.mockReturnValue(10);

      const result = wrapper.clear();

      expect(result).toBe(10);
      expect(llmCache.clear).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const wrapper = new LLMCacheWrapper();
      const mockStats = {
        size: 10,
        hits: 50,
        misses: 10,
        hit_rate: 83.33
      };
      
      llmCache.getStats.mockReturnValue(mockStats);

      const stats = wrapper.getStats();

      expect(stats).toEqual(mockStats);
      expect(llmCache.getStats).toHaveBeenCalled();
    });
  });

  describe('getHealthMetrics', () => {
    it('should return health metrics', () => {
      const wrapper = new LLMCacheWrapper();
      const mockMetrics = {
        health_score: 85,
        avg_age_ms: 3600000
      };
      
      llmCache.getHealthMetrics.mockReturnValue(mockMetrics);

      const metrics = wrapper.getHealthMetrics();

      expect(metrics).toEqual(mockMetrics);
      expect(llmCache.getHealthMetrics).toHaveBeenCalled();
    });
  });

  describe('optimize', () => {
    it('should optimize cache when enabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: true });
      const mockResult = {
        expired_removed: 5,
        low_value_removed: 3
      };
      
      llmCache.optimize.mockReturnValue(mockResult);

      const result = wrapper.optimize();

      expect(result).toEqual(mockResult);
      expect(llmCache.optimize).toHaveBeenCalled();
    });

    it('should return message when cache disabled', () => {
      const wrapper = new LLMCacheWrapper({ enabled: false });

      const result = wrapper.optimize();

      expect(result).toEqual({ message: 'Cache is disabled' });
      expect(llmCache.optimize).not.toHaveBeenCalled();
    });
  });

  describe('cachedCall', () => {
    it('should return cached response on cache hit', async () => {
      const wrapper = new LLMCacheWrapper({ enabled: true });
      const mockCached = { content: 'cached', tokens: 100 };
      const mockLLMFunction = jest.fn();
      
      llmCache.get.mockReturnValue(mockCached);

      const result = await wrapper.cachedCall(mockLLMFunction, 'test prompt');

      expect(result).toEqual({ ...mockCached, _cached: true });
      expect(mockLLMFunction).not.toHaveBeenCalled();
      expect(llmCache.get).toHaveBeenCalled();
    });

    it('should call LLM and cache on cache miss', async () => {
      const wrapper = new LLMCacheWrapper({ enabled: true });
      const mockResponse = { content: 'fresh', tokens: 100 };
      const mockLLMFunction = jest.fn().mockResolvedValue(mockResponse);
      
      llmCache.get.mockReturnValue(null);
      llmCache.set.mockReturnValue('cache-key');

      const result = await wrapper.cachedCall(mockLLMFunction, 'test prompt', { model: 'qwen' }, ['tag1']);

      expect(result).toEqual({ ...mockResponse, _cached: false });
      expect(mockLLMFunction).toHaveBeenCalledWith('test prompt', { model: 'qwen' });
      expect(llmCache.set).toHaveBeenCalledWith('test prompt', { model: 'qwen' }, mockResponse, expect.any(Number), ['tag1']);
    });

    it('should bypass cache when disabled', async () => {
      const wrapper = new LLMCacheWrapper({ enabled: false });
      const mockResponse = { content: 'fresh', tokens: 100 };
      const mockLLMFunction = jest.fn().mockResolvedValue(mockResponse);

      const result = await wrapper.cachedCall(mockLLMFunction, 'test prompt');

      expect(result).toEqual(mockResponse);
      expect(mockLLMFunction).toHaveBeenCalled();
      expect(llmCache.get).not.toHaveBeenCalled();
      expect(llmCache.set).not.toHaveBeenCalled();
    });
  });

  describe('enable/disable', () => {
    it('should enable cache', () => {
      const wrapper = new LLMCacheWrapper({ enabled: false });
      
      expect(wrapper.isEnabled()).toBe(false);
      
      wrapper.enable();
      
      expect(wrapper.isEnabled()).toBe(true);
    });

    it('should disable cache', () => {
      const wrapper = new LLMCacheWrapper({ enabled: true });
      
      expect(wrapper.isEnabled()).toBe(true);
      
      wrapper.disable();
      
      expect(wrapper.isEnabled()).toBe(false);
    });
  });

  describe('createCacheWrapper', () => {
    it('should create wrapper instance', () => {
      const wrapper = createCacheWrapper({ ttl: 3600000 });
      
      expect(wrapper).toBeInstanceOf(LLMCacheWrapper);
      expect(wrapper.config.ttl).toBe(3600000);
    });
  });
});
