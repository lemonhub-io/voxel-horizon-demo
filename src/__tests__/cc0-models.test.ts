import { describe, expect, it } from 'vitest';
import { preloadCC0Models } from '../cc0-models';
import { CC0_MODEL_ASSETS } from '../model-assets';

describe('remote model preflight', () => {
  it('reports every unavailable model before entering a test-mode world', async () => {
    const failures = await preloadCC0Models();
    expect(failures).toHaveLength(CC0_MODEL_ASSETS.length);
    expect(failures.map(failure => failure.id)).toEqual(CC0_MODEL_ASSETS.map(asset => asset.id));
  });
});