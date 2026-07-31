import { navigationRef } from '../navigationRef';

describe('navigationRef', () => {
  it('exposes a navigation container ref with an isReady guard', () => {
    expect(navigationRef).toBeDefined();
    expect(typeof navigationRef.isReady).toBe('function');
  });

  it('reports not ready before a NavigationContainer attaches to it', () => {
    expect(navigationRef.isReady()).toBe(false);
  });
});
