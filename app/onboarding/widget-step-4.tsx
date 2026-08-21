import { router } from 'expo-router';

import { WidgetStepScreen } from '@/components/widget/WidgetStepScreen';

// Widget walkthrough, step 4 of 4. Adding the widget is self-reported — iOS
// gives us no way to check whether it actually landed on the home screen.
export default function WidgetStep4Screen() {
  return (
    <WidgetStepScreen
      step={3}
      ctaLabel="I've enabled the widget"
      onNext={() => router.replace('/onboarding/widget-done')}
    />
  );
}
