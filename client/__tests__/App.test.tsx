/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@op-engineering/op-sqlite', () => ({
  Storage: class {
    async getItem() {
      return undefined;
    }

    async setItem() {}

    async removeItem() {}
  },
  isSQLCipher: () => true,
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
