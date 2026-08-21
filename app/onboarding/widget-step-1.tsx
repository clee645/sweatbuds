import { router } from 'expo-router';

import { WidgetStepScreen } from '@/components/widget/WidgetStepScreen';

// Widget walkthrough, step 1 of 4.
export default function WidgetStep1Screen() {
  return (
    <WidgetStepScreen
      step={0}
      ctaLabel="Continue"
      showBack={false}
      onNext={() => router.push('/onboarding/widget-step-2')}
    />
  );
}
