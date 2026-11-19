import { useAppearance } from '@/lib/appearance';
import type { Appearance } from '@/lib/theme';

import { Card, Segmented, T } from './ui';

const CHOICES: { key: Appearance; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

/**
 * Light or dark mode. "Auto" follows the phone's own setting, or the browser's on the website.
 * The choice is kept on this device, so guests have it too, and it takes effect at once.
 */
export function AppearanceRow() {
  const { choice, choose } = useAppearance();
  return (
    <Card style={{ padding: 18, gap: 10 }}>
      <T size={16} weight="extra">
        Appearance
      </T>
      <Segmented flat label="Appearance" options={CHOICES} value={choice} onChange={choose} />
    </Card>
  );
}
