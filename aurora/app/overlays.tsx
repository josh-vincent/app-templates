import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell, BookmarkCheck, Layers, ListChecks, MessageSquare, MoveRight, Trash2 } from 'lucide-react-native';

import { GlassButton, GlassSurface } from '@/components/GlassPrimitives';
import {
  GlassActionSheet,
  GlassAlert,
  GlassBottomSheet,
  GlassPopover,
  GlassSideDrawer,
  useGlassToast,
} from '@/components/GlassOverlays';

export default function OverlaysShowcase() {
  const toast = useGlassToast();
  const [bottomSheet, setBottomSheet] = useState(false);
  const [tallSheet, setTallSheet] = useState(false);
  const [sideDrawer, setSideDrawer] = useState(false);
  const [actionSheet, setActionSheet] = useState(false);
  const [destructiveAlert, setDestructiveAlert] = useState(false);
  const [accentAlert, setAccentAlert] = useState(false);
  const [popover, setPopover] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0E27' }}>
      <LinearGradient
        colors={['#1A1B4B', '#0A0E27']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 18 }}>
          Every glass overlay primitive in Aurora. Tap any tile to preview.
        </Text>

        <Section title="SHEETS">
          <GlassButton
            label="Bottom sheet · short"
            icon={<Layers size={18} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={() => setBottomSheet(true)}
          />
          <View style={{ height: 8 }} />
          <GlassButton
            label="Bottom sheet · tall"
            icon={<Layers size={18} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={() => setTallSheet(true)}
          />
        </Section>

        <Section title="SIDE DRAWERS">
          <GlassButton
            intent="accent"
            label="Right-side drawer"
            icon={<MoveRight size={18} color="#FFFFFF" strokeWidth={2.4} />}
            onPress={() => setSideDrawer(true)}
          />
        </Section>

        <Section title="ACTION SHEET">
          <GlassButton
            label="Show action sheet"
            icon={<ListChecks size={18} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={() => setActionSheet(true)}
          />
        </Section>

        <Section title="ALERTS">
          <GlassButton
            intent="accent"
            label="Confirm alert · accent"
            icon={<BookmarkCheck size={18} color="#FFFFFF" strokeWidth={2.4} />}
            onPress={() => setAccentAlert(true)}
          />
          <View style={{ height: 8 }} />
          <GlassButton
            intent="danger"
            label="Destructive alert"
            icon={<Trash2 size={18} color="#FFFFFF" strokeWidth={2.4} />}
            onPress={() => setDestructiveAlert(true)}
          />
        </Section>

        <Section title="TOASTS">
          <GlassButton
            intent="success"
            label="Show success toast"
            icon={<Bell size={18} color="#06301F" strokeWidth={2.6} />}
            onPress={() => toast.show('Location added · 6 saved', 'success')}
          />
          <View style={{ height: 8 }} />
          <GlassButton
            intent="danger"
            label="Show danger toast"
            icon={<Bell size={18} color="#FFFFFF" strokeWidth={2.4} />}
            onPress={() => toast.show("Couldn't fetch forecast", 'danger')}
          />
          <View style={{ height: 8 }} />
          <GlassButton
            label="Show info toast"
            icon={<Bell size={18} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={() => toast.show('Aurora · using mock data only')}
          />
        </Section>

        <Section title="POPOVER">
          <GlassButton
            label="Anchored info popover"
            icon={<MessageSquare size={18} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={() => setPopover(true)}
          />
        </Section>
      </ScrollView>

      {/* --- Overlays --- */}
      <GlassBottomSheet
        visible={bottomSheet}
        onClose={() => setBottomSheet(false)}
        title="Now in San Francisco"
        subtitle="Quick view"
        detent={0.45}>
        <GlassSurface style={{ marginVertical: 14 }}>
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '300' }}>62°</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
              Partly cloudy · feels like 60°
            </Text>
          </View>
        </GlassSurface>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          Drag the grabber down or tap outside to dismiss. Sheets can stack on top of
          the FormSheet without losing the glass effect underneath.
        </Text>
      </GlassBottomSheet>

      <GlassBottomSheet
        visible={tallSheet}
        onClose={() => setTallSheet(false)}
        title="Tall sheet"
        subtitle="0.85 detent"
        detent={0.85}>
        {Array.from({ length: 14 }).map((_, i) => (
          <GlassSurface key={i} style={{ marginVertical: 6 }} radius={14}>
            <View style={{ padding: 14 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
                Row {i + 1}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
                Scrollable glass content inside a tall sheet.
              </Text>
            </View>
          </GlassSurface>
        ))}
      </GlassBottomSheet>

      <GlassSideDrawer
        visible={sideDrawer}
        onClose={() => setSideDrawer(false)}
        title="Quick settings">
        {['Wind speed', 'Pressure', 'Visibility', 'Air quality', 'Sun & moon'].map((s) => (
          <GlassSurface key={s} radius={14} style={{ marginBottom: 8 }}>
            <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1 }}>
                {s}
              </Text>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: 'rgba(11,246,160,0.5)',
                }}
              />
            </View>
          </GlassSurface>
        ))}
      </GlassSideDrawer>

      <GlassActionSheet
        visible={actionSheet}
        title="San Francisco"
        message="What would you like to do with this location?"
        onClose={() => setActionSheet(false)}
        actions={[
          {
            label: 'Set as active',
            onPress: () => toast.show('San Francisco is now active', 'success'),
          },
          {
            label: 'Share forecast',
            onPress: () => toast.show('Share sheet would open here'),
          },
          {
            label: 'Remove location',
            intent: 'danger',
            onPress: () => toast.show('Location removed', 'danger'),
          },
        ]}
      />

      <GlassAlert
        visible={accentAlert}
        title="Save your changes?"
        message="You can update your notification settings later in Profile."
        primaryLabel="Save"
        primaryIntent="accent"
        onPrimary={() => toast.show('Saved', 'success')}
        onClose={() => setAccentAlert(false)}
      />

      <GlassAlert
        visible={destructiveAlert}
        title="Remove this location?"
        message="Removing San Francisco will also clear its cached forecast. This cannot be undone."
        primaryLabel="Remove"
        primaryIntent="danger"
        onPrimary={() => toast.show('Location removed', 'danger')}
        onClose={() => setDestructiveAlert(false)}
      />

      <GlassPopover
        visible={popover}
        anchor={{ x: 0.5, y: 0.5 }}
        onClose={() => setPopover(false)}>
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>UV Index 6</Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 6, lineHeight: 18 }}>
          High exposure for the average person. Use sunscreen if outside 30 min+.
        </Text>
      </GlassPopover>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text
        style={{
          color: 'rgba(255,255,255,0.65)',
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.4,
          marginBottom: 10,
        }}>
        {title}
      </Text>
      {children}
    </View>
  );
}
