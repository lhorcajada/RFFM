jest.mock('@expo/vector-icons', () => ({
  Ionicons: {
    name: 'mock-icon',
  },
  Ionicons: jest.fn(() => null),
}));
