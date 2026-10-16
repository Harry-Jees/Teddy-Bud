import { DeviceAuthService } from '../src/services/deviceAuth';

test('does not fall back to plaintext storage when secure storage is unavailable', async () => {
  await expect(new DeviceAuthService().register()).rejects.toThrow();
});
