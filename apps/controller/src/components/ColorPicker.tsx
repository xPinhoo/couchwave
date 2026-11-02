import { hslToHex, type Hsl } from '@couchwave/shared';
import { memo, useRef, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme';

const HUES = 24;
const LIGHTS = 12;
const SATURATIONS = 16;
/** The palette stops short of pure white and black: the bar below can't change those. */
const LIGHT_MAX = 96;
const LIGHT_MIN = 6;

interface ColorPickerProps {
  value: Hsl;
  disabled: boolean;
  /** As the finger moves. */
  onChange: (value: Hsl) => void;
  /** When the finger lifts. */
  onRelease: () => void;
}

const lightAt = (y: number) => LIGHT_MAX - y * (LIGHT_MAX - LIGHT_MIN);
const yOf = (light: number) => (LIGHT_MAX - light) / (LIGHT_MAX - LIGHT_MIN);
const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Follows a finger across an area, as fractions of its size. Works on the web and natively. */
function TouchArea({
  label,
  style,
  disabled,
  onMove,
  onRelease,
  children,
}: {
  label: string;
  style: ViewStyle;
  disabled: boolean;
  onMove: (x: number, y: number) => void;
  onRelease: () => void;
  children: ReactNode;
}) {
  const size = useRef({ width: 1, height: 1 });
  const origin = useRef({ x: 0, y: 0 });

  const move = ({ nativeEvent: { pageX, pageY } }: GestureResponderEvent) => {
    onMove(
      clamp((pageX - origin.current.x) / size.current.width),
      clamp((pageY - origin.current.y) / size.current.height),
    );
  };

  return (
    <View
      aria-label={label}
      role="slider"
      style={[style, styles.touch]}
      onLayout={({ nativeEvent }: LayoutChangeEvent) => {
        size.current = nativeEvent.layout;
      }}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => {
        const { pageX, pageY, locationX, locationY } = event.nativeEvent;
        // The children ignore touches, so this is relative to the area itself
        origin.current = { x: pageX - locationX, y: pageY - locationY };
        move(event);
      }}
      onResponderMove={move}
      onResponderRelease={onRelease}
      onResponderTerminate={onRelease}
    >
      {children}
    </View>
  );
}

/** Every hue from left to right and light to dark from top to bottom. */
const Palette = memo(function Palette({ saturation }: { saturation: number }) {
  return (
    <>
      {Array.from({ length: LIGHTS }, (_, row) => (
        <View key={row} style={styles.row}>
          {Array.from({ length: HUES }, (_, column) => (
            <View
              key={column}
              style={[
                styles.cell,
                {
                  backgroundColor: hslToHex({
                    h: ((column + 0.5) / HUES) * 360,
                    s: saturation,
                    l: lightAt((row + 0.5) / LIGHTS),
                  }),
                },
              ]}
            />
          ))}
        </View>
      ))}
    </>
  );
});

/** How strong the colour is: from grey on the left to full colour on the right. */
const SaturationBar = memo(function SaturationBar({ h, l }: { h: number; l: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: SATURATIONS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.cell,
            { backgroundColor: hslToHex({ h, s: ((i + 0.5) / SATURATIONS) * 100, l }) },
          ]}
        />
      ))}
    </View>
  );
});

/** The colour palette: drag across it to choose a hue and lightness, then set the strength. */
export function ColorPicker({ value, disabled, onChange, onRelease }: ColorPickerProps) {
  return (
    <View style={styles.picker}>
      <TouchArea
        label="Colour palette"
        style={styles.palette}
        disabled={disabled}
        onRelease={onRelease}
        onMove={(x, y) => onChange({ ...value, h: x * 360, l: lightAt(y) })}
      >
        <Palette saturation={value.s} />
        <View
          style={[
            styles.marker,
            { left: `${(value.h / 360) * 100}%`, top: `${clamp(yOf(value.l)) * 100}%` },
          ]}
        />
      </TouchArea>
      <TouchArea
        label="Colour strength"
        style={styles.bar}
        disabled={disabled}
        onRelease={onRelease}
        onMove={(x) => onChange({ ...value, s: x * 100 })}
      >
        <SaturationBar h={value.h} l={value.l} />
        <View style={[styles.marker, styles.barMarker, { left: `${value.s}%` }]} />
      </TouchArea>
    </View>
  );
}

const MARKER = 22;

const styles = StyleSheet.create({
  picker: {
    flex: 1,
    gap: 10,
    minHeight: 220,
  },
  // Touches belong to the area, not the cells, and dragging mustn't scroll the page
  touch: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    touchAction: 'none',
    userSelect: 'none',
    cursor: 'crosshair',
  } as unknown as ViewStyle,
  palette: {
    flex: 1,
  },
  bar: {
    height: 48,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    pointerEvents: 'none',
  },
  cell: {
    flex: 1,
    pointerEvents: 'none',
  },
  marker: {
    position: 'absolute',
    width: MARKER,
    height: MARKER,
    marginLeft: -MARKER / 2,
    marginTop: -MARKER / 2,
    borderRadius: MARKER / 2,
    borderWidth: 3,
    borderColor: '#fff',
    boxShadow: '0 0 0 2px #000',
    pointerEvents: 'none',
  },
  barMarker: {
    top: '50%',
  },
});
