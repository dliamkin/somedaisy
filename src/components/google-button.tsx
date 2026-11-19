import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { T } from '@/components/ui';
import { googleAvailable, googleClientId, loadGoogle, makeNonce } from '@/lib/google';
import { askGoogle } from '@/lib/google-phone';
import { GOOGLE_LOGO, useTheme } from '@/lib/theme';

const HEIGHT = 44;
const PHONE_HEIGHT = 48;
// Google draws the button itself and allows it to be at most this wide.
const MAX_WIDTH = 400;

type Props = {
  onCredential: (credential: string, rawNonce: string) => void;
  busy?: boolean;
  attempt?: number;
};

/**
 * "Continue with Google". When the person has chosen an account, `onCredential` receives Google's
 * signed note and the secret that goes with it. On the website this is Google's own button and
 * pop-up; in the phone app it is our button and Android's account sheet.
 */
export function GoogleButton(props: Props) {
  if (!googleAvailable) return null;
  return Platform.OS === 'web' ? <WebGoogleButton {...props} /> : <PhoneGoogleButton {...props} />;
}

/** The phone app's button. Each press asks Android afresh, with a fresh secret. */
function PhoneGoogleButton({ onCredential, busy }: Props) {
  const { colors } = useTheme();
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);

  const press = async () => {
    if (asking) return;
    setAsking(true);
    setFailed(false);
    try {
      const answer = await askGoogle();
      // No answer means they closed the sheet without choosing, which is not a failure.
      if (answer) onCredential(answer.credential, answer.rawNonce);
    } catch {
      setFailed(true);
    } finally {
      setAsking(false);
    }
  };

  const waiting = Boolean(busy) || asking;
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        accessibilityState={{ disabled: waiting, busy: waiting }}
        disabled={waiting}
        onPress={() => void press()}
        style={({ pressed }) => ({
          height: PHONE_HEIGHT,
          borderRadius: PHONE_HEIGHT / 2,
          borderWidth: 2,
          borderColor: colors.line,
          backgroundColor: colors.white,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: pressed ? 0.85 : 1,
        })}>
        {waiting ? (
          <ActivityIndicator color={colors.button} />
        ) : (
          <>
            <GoogleLogo size={20} />
            {/* Google's rules ask for a white button in every mode, so the words on it are always dark. */}
            <T size={16} weight="extra" color={colors.ink}>
              Continue with Google
            </T>
          </>
        )}
      </Pressable>
      {failed ? (
        <T size={14} weight="medium" color={colors.textMuted} center>
          Google sign-in did not work on this phone. You can still use your email.
        </T>
      ) : null}
    </View>
  );
}

/** Google's "G", which their rules ask for on a button like this. */
function GoogleLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill={GOOGLE_LOGO.red} d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill={GOOGLE_LOGO.blue} d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill={GOOGLE_LOGO.yellow} d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill={GOOGLE_LOGO.green} d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/**
 * The website's button: Google's own, which opens Google's pop-up. Change `attempt` to draw a
 * fresh button with a fresh secret, for example after a failure.
 */
function WebGoogleButton({ onCredential, busy, attempt = 0 }: Props) {
  const { colors } = useTheme();
  const holder = useRef<ComponentRef<typeof View>>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);
  // Always call the latest handler, without redrawing the button when it changes.
  const handler = useRef(onCredential);
  useEffect(() => {
    handler.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (width === 0) return;
    let alive = true;
    Promise.all([loadGoogle(), makeNonce()]).then(
      ([google, nonce]) => {
        // On the web a View is an ordinary page element, which is what Google draws into.
        const element = holder.current as unknown as HTMLElement | null;
        if (!alive || !element) return;
        google.initialize({
          client_id: googleClientId,
          nonce: nonce.hashed,
          callback: (response) => {
            if (response.credential) handler.current(response.credential, nonce.raw);
          },
        });
        element.replaceChildren();
        google.renderButton(element, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          width: Math.min(MAX_WIDTH, Math.floor(width)),
        });
        setFailed(false);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [width, attempt]);

  return (
    <View style={{ gap: 8 }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ minHeight: HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
        <View ref={holder} style={{ display: busy ? 'none' : 'flex' }} />
        {busy ? <ActivityIndicator color={colors.button} /> : null}
      </View>
      {failed ? (
        <T size={14} weight="medium" color={colors.textMuted} center>
          Google sign-in could not load here. You can still use your email.
        </T>
      ) : null}
    </View>
  );
}

/** A quiet "or" between two ways of doing the same thing. */
export function OrLine() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 2, backgroundColor: colors.line }} />
      <T size={14} weight="medium" color={colors.textMuted}>
        or
      </T>
      <View style={{ flex: 1, height: 2, backgroundColor: colors.line }} />
    </View>
  );
}
