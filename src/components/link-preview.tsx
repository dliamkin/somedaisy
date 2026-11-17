import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { tidyLink } from '@/lib/links';
import { fetchPreviewPicture, previewState, type LinkPreview, type Looked } from '@/lib/preview';
import { colors } from '@/lib/theme';

import { PreviewPicture } from './preview-picture';
import { T } from './ui';

// How long the typing has to pause before the picture is looked up, so a link is not looked up
// once for every letter.
const WAIT = 800;

/**
 * The picture for the link being typed into a form, looked up once the typing pauses.
 * `known` is a link whose picture is already saved (the idea being edited), which needs no lookup.
 */
export function useLinkPreview(typed: string, known?: Looked | null): LinkPreview {
  const tidy = tidyLink(typed);
  const link = tidy.ok ? tidy.link : null;
  const [looked, setLooked] = useState<Looked | null>(null);
  const settled = known && known.picture && known.link === link ? known : looked;
  const waiting = link !== null && settled?.link !== link;

  useEffect(() => {
    if (!link || !waiting) return;
    let alive = true;
    const timer = setTimeout(() => {
      void fetchPreviewPicture(link).then((picture) => {
        // An answer for a link that has since been changed is dropped.
        if (alive) setLooked({ link, picture });
      });
    }, WAIT);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [link, waiting]);

  return previewState(link, settled);
}

/** Under a form's link box: the picture the idea will get, or a line saying there is none. */
export function LinkPreviewNote({ preview, label }: { preview: LinkPreview; label: string }) {
  // The picture's address was found but the picture itself would not load.
  const [broken, setBroken] = useState<string | null>(null);
  if (preview.state === 'none') return null;
  if (preview.state === 'looking') {
    return (
      <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ActivityIndicator size="small" color={colors.grape} />
        <T size={14} color={colors.muted}>
          Looking for a picture...
        </T>
      </View>
    );
  }
  if (preview.state === 'found' && broken !== preview.picture) {
    return (
      <View style={{ gap: 6 }}>
        <PreviewPicture uri={preview.picture} label={label || 'this idea'} onBroken={() => setBroken(preview.picture)} />
        <T size={14} color={colors.muted}>
          This picture will show on the idea.
        </T>
      </View>
    );
  }
  return (
    <T size={14} color={colors.muted}>
      No picture found for this link. The idea will show its list&apos;s icon, and the link still works.
    </T>
  );
}
