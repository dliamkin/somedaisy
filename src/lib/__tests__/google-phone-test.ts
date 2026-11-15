import { askGoogle } from '../google-phone.native';

type Hash = { update: (text: string, encoding: 'utf8') => Hash; digest: (encoding: 'hex') => string };
const { createHash } = jest.requireActual<{ createHash: (algorithm: string) => Hash }>('node:crypto');

const mockConfigure = jest.fn();
const mockCheckPlayServices = jest.fn(async () => {});
const mockPresentExplicitSignIn = jest.fn();
const mockOrder: string[] = [];

jest.mock('../google', () => ({ googleClientId: 'web-client-id' }));
jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual<{ createHash: (algorithm: string) => Hash; randomBytes: (n: number) => Uint8Array }>('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomBytes: (n: number) => crypto.randomBytes(n),
    digestStringAsync: async (_algorithm: string, text: string) => crypto.createHash('sha256').update(text, 'utf8').digest('hex'),
  };
});
jest.mock(
  'react-native-nitro-google-signin',
  () => ({
    GoogleOneTapSignIn: {
      configure: (params: unknown) => {
        mockOrder.push('configure');
        mockConfigure(params);
      },
      checkPlayServices: () => {
        mockOrder.push('check');
        return mockCheckPlayServices();
      },
      presentExplicitSignIn: () => {
        mockOrder.push('ask');
        return mockPresentExplicitSignIn();
      },
    },
    isSuccessResponse: (response: { type: string }) => response.type === 'success',
  }),
);

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

beforeEach(() => {
  jest.clearAllMocks();
  mockOrder.length = 0;
  mockPresentExplicitSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-note' } });
});

describe('askGoogle', () => {
  it('hands back Google\'s note and the secret that goes with it', async () => {
    const answer = await askGoogle();
    expect(answer?.credential).toBe('google-note');
    expect(answer?.rawNonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives Google the website\'s client ID and the SHA-256 of the secret, before asking', async () => {
    const answer = await askGoogle();
    expect(mockConfigure).toHaveBeenCalledWith({ webClientId: 'web-client-id', nonce: sha256(answer?.rawNonce ?? '') });
    expect(mockOrder).toEqual(['configure', 'check', 'ask']);
  });

  it('uses a different secret every time', async () => {
    const first = await askGoogle();
    const second = await askGoogle();
    expect(first?.rawNonce).not.toBe(second?.rawNonce);
    expect(mockConfigure.mock.calls[0][0].nonce).not.toBe(mockConfigure.mock.calls[1][0].nonce);
  });

  it('gives nothing back when the person closes the sheet', async () => {
    mockPresentExplicitSignIn.mockResolvedValue({ type: 'cancelled', data: null });
    expect(await askGoogle()).toBeNull();
  });

  it('fails when Google Play services are missing, without asking', async () => {
    mockCheckPlayServices.mockRejectedValueOnce(new Error('[PLAY_SERVICES_NOT_AVAILABLE] no Play services'));
    await expect(askGoogle()).rejects.toThrow('Play services');
    expect(mockPresentExplicitSignIn).not.toHaveBeenCalled();
  });

  it('fails when Android refuses the app', async () => {
    mockPresentExplicitSignIn.mockRejectedValue(new Error('[DEVELOPER_ERROR] wrong SHA-1'));
    await expect(askGoogle()).rejects.toThrow('DEVELOPER_ERROR');
  });
});

