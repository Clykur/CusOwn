'use client';

import CheckIcon from '@/src/icons/check.svg';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export default function OnboardingProgress({
  currentStep,
  totalSteps,
  steps,
}: OnboardingProgressProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-gray-500">
          {Math.round((currentStep / totalSteps) * 100)}% Complete
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-black h-2 rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
      <div className="flex justify-between mt-4">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`flex-1 text-center ${
              index < currentStep - 1
                ? 'text-black'
                : index === currentStep - 1
                  ? 'text-black font-semibold'
                  : 'text-gray-400'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${
                index < currentStep - 1
                  ? 'bg-black text-white'
                  : index === currentStep - 1
                    ? 'bg-black text-white'
                    : 'bg-gray-200 text-gray-400'
              }`}
            >
              {index < currentStep - 1 ? (
                <CheckIcon className="w-5 h-5" aria-hidden="true" />
              ) : (
                <span className="text-sm font-semibold">{index + 1}</span>
              )}
            </div>
            <p className="text-xs">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
