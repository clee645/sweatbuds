import { router } from 'expo-router';

import { WidgetStepScreen } from '@/components/widget/WidgetStepScreen';

// Widget walkthrough, step 2 of 4.
export default function WidgetStep2Screen() {
  return (
    <WidgetStepScreen
      step={1}
      ctaLabel="Continue"
      onNext={() => router.push('/onboarding/widget-step-3')}
    />
  );
}
