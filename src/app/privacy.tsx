import { Linking, Pressable, View } from 'react-native';

import { Card, Screen, T, TopBar } from '@/components/ui';
import { CONTACT, INTRO, SECTIONS, UPDATED, type Block } from '@/lib/privacy';
import { useTheme } from '@/lib/theme';

// The privacy policy. Anyone can read it, signed in or not; the words live in src/lib/privacy.ts.
export default function Privacy() {
  const { colors } = useTheme();
  return (
    <Screen>
      <TopBar title="Privacy" subtitle={`Updated ${UPDATED}`} backTo="/" />
      <View style={{ gap: 12 }}>
        {INTRO.map((text) => (
          <Paragraph key={text} text={text} />
        ))}
      </View>
      {SECTIONS.map((section) => (
        <Card key={section.title} style={{ padding: 18, gap: 12 }}>
          <T size={18} weight="extra" style={{ lineHeight: 24 }}>
            {section.title}
          </T>
          {section.blocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </Card>
      ))}
      <Card style={{ padding: 18, gap: 12 }}>
        <T size={18} weight="extra" style={{ lineHeight: 24 }}>
          Contact
        </T>
        <Paragraph text="Questions about this page or about your information? Write to us." />
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${CONTACT}`)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <T size={16} weight="extra" color={colors.link}>
            {CONTACT}
          </T>
        </Pressable>
      </Card>
    </Screen>
  );
}

function Paragraph({ text }: { text: string }) {
  return (
    <T size={15} weight="medium" style={{ lineHeight: 22 }}>
      {text}
    </T>
  );
}

function BlockView({ block }: { block: Block }) {
  const { colors } = useTheme();
  if (typeof block === 'string') return <Paragraph text={block} />;
  return (
    <View style={{ gap: 10 }}>
      {block.map((point) => (
        <View key={point} style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.button, marginTop: 8 }} />
          <View style={{ flex: 1 }}>
            <Paragraph text={point} />
          </View>
        </View>
      ))}
    </View>
  );
}
