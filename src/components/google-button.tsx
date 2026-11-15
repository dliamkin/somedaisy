import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { T } from '@/components/ui';
import { googleAvailable, googleClientId, loadGoogle, makeNonce } from '@/lib/google';
import { colors } from '@/lib/theme';

const HEIGHT = 44;
// Google draws the button itself and allows it to be at most this wide.
const MAX_WIDTH = 400;

/**
 * Google's own "Continue with Google" button. Pressing it opens Google's pop-up; when the person
 * has chosen an account, `onCredential` receives Google's signed note and the secret that goes
 * with it. Change `attempt` to draw a fresh button with a fresh secret, for example after a failure.
 */
export function GoogleButton({
  onCredential,
  busy,
  attempt = 0,
}: {
  onCredential: (credential: string, rawNonce: string) => void;
  busy?: boolean;
  attempt?: number;
}) {
  const holder = useRef<ComponentRef<typeof View>>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);
  // Always call the latest handler, without redrawing the button when it changes.
  const handler = useRef(onCredential);
  useEffect(() => {
    handler.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!googleAvailable || width === 0) return;
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

  if (!googleAvailable) return null;
  return (
    <View style={{ gap: 8 }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ minHeight: HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
        <View ref={holder} style={{ display: busy ? 'none' : 'flex' }} />
        {busy ? <ActivityIndicator color={colors.grape} /> : null}
      </View>
      {failed ? (
        <T size={14} weight="medium" color={colors.muted} center>
          Google sign-in could not load here. You can still use your email.
        </T>
      ) : null}
    </View>
  );
}

/** A quiet "or" between two ways of doing the same thing. */
export function OrLine() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 2, backgroundColor: colors.line }} />
      <T size={14} weight="medium" color={colors.muted}>
        or
      </T>
      <View style={{ flex: 1, height: 2, backgroundColor: colors.line }} />
    </View>
  );
}
