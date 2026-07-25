import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { PanResponder, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radii } from '@/lib/theme';

export type SignaturePadHandle = { clear: () => void };

type Props = {
  style?: StyleProp<ViewStyle>;
  // Fires whenever the pad goes from empty → has-content or back.
  onSignedChange?: (signed: boolean) => void;
};

// Finger-drawing signature pad — captures strokes as SVG paths. No webview or
// extra dependency; built on PanResponder + react-native-svg.
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(
  ({ style, onSignedChange }, ref) => {
    const [paths, setPaths] = useState<string[]>([]);
    const [current, setCurrent] = useState('');
    const currentRef = useRef('');

    useImperativeHandle(ref, () => ({
      clear: () => {
        setPaths([]);
        setCurrent('');
        currentRef.current = '';
        onSignedChange?.(false);
      },
    }));

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          currentRef.current = `M ${locationX} ${locationY}`;
          setCurrent(currentRef.current);
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          currentRef.current += ` L ${locationX} ${locationY}`;
          setCurrent(currentRef.current);
        },
        onPanResponderRelease: () => {
          const finished = currentRef.current;
          currentRef.current = '';
          setCurrent('');
          if (finished.includes('L')) {
            setPaths((p) => [...p, finished]);
            onSignedChange?.(true);
          }
        },
      }),
    ).current;

    return (
      <View style={[styles.box, style]} {...panResponder.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={colors.text}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {current ? (
            <Path
              d={current}
              stroke={colors.text}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
      </View>
    );
  },
);

SignaturePad.displayName = 'SignaturePad';

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.cardElevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
