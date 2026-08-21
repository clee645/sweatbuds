import { router } from 'expo-router';

import { WidgetStepScreen } from '@/components/widget/WidgetStepScreen';

// Widget walkthrough, step 3 of 4.
export default function WidgetStep3Screen() {
  return (
    <WidgetStepScreen
      step={2}
      ctaLabel="Continue"
      onNext={() => router.push('/onboarding/widget-step-4')}
    />
  );
}
