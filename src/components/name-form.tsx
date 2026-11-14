import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useSession } from '@/lib/session';
import { avatarColors, colors } from '@/lib/theme';

import { Button, Card, ErrorNote, Field, T } from './ui';

/** Name and avatar color. This is all someone needs to start: no account. */
export function NameForm({
  cta,
  onDone,
  initial,
}: {
  cta: string;
  onDone: () => void | Promise<void>;
  /** The current name and colour, when changing them instead of choosing for the first time. */
  initial?: { name: string; color: string };
}) {
  const { saveProfile } = useSession();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? avatarColors[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveProfile(name, color);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your name.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ padding: 18, gap: 18 }}>
        <Field label="Your name" value={name} onChangeText={setName} placeholder="What should friends call you?" maxLength={40} onSubmit={submit} />
        <View style={{ gap: 8 }}>
          <T size={16} weight="extra">
            Pick a color
          </T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {avatarColors.map((c, i) => (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={`Avatar color ${i + 1}`}
                accessibilityState={{ selected: c === color }}
                onPress={() => setColor(c)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: c,
                  borderWidth: 3,
                  borderColor: c === color ? colors.grape : 'transparent',
                }}
              />
            ))}
          </View>
        </View>
      </Card>
      <ErrorNote message={error} />
      <Button label={cta} onPress={submit} disabled={!name.trim()} busy={busy} />
    </View>
  );
}
