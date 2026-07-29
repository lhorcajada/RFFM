jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: ({ testID, name, size, color }) =>
      React.createElement('Icon', { testID, name, size, color }),
  };
});
