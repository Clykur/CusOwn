#!/usr/bin/env ts-node
/**
 * Unit tests: lib/design/tokens
 * Structure and presence of tokens and tw. No mocks.
 */

import { tokens, tw } from '../../lib/design/tokens';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitDesignTokensTests(): void {
  console.log('\n--- unit: lib/design/tokens ---\n');

  runTest('tokens.spacing has expected keys', () => {
    assert(tokens.spacing.xs === '0.5rem', 'xs');
    assert(tokens.spacing.md === '1rem', 'md');
    assert(tokens.spacing['2xl'] != null, '2xl');
  });

  runTest('tokens.sidebar has width and mobileBreakpoint', () => {
    assert(typeof tokens.sidebar.width === 'string', 'width');
    assert(typeof tokens.sidebar.mobileBreakpoint === 'string', 'mobileBreakpoint');
  });

  runTest('tokens.container.maxWidth has breakpoints', () => {
    assert(tokens.container.maxWidth.sm != null, 'sm');
    assert(tokens.container.maxWidth.lg != null, 'lg');
  });

  runTest('tokens.radius has expected keys', () => {
    assert(tokens.radius.sm === '0.5rem', 'radius.sm');
    assert(tokens.radius.full === '9999px', 'radius.full');
  });

  runTest('tokens.colors.primary has DEFAULT and hover', () => {
    assert(tokens.colors.primary.DEFAULT != null, 'primary.DEFAULT');
    assert(tokens.colors.primary.hover != null, 'primary.hover');
  });

  runTest('tokens.typography.heading has levels 1-6', () => {
    assert(tokens.typography.heading['1'].size != null, 'heading 1');
    assert(tokens.typography.heading['6'].size != null, 'heading 6');
  });

  runTest('tw.spacing and tw.gap have same scale keys', () => {
    assert(tw.spacing.xs === 'p-2', 'tw.spacing.xs');
    assert(tw.gap.xs === 'gap-2', 'tw.gap.xs');
  });

  runTest('tw.radius has Tailwind class strings', () => {
    assert(tw.radius.sm === 'rounded-lg', 'tw.radius.sm');
    assert(tw.radius.md === 'rounded-xl', 'tw.radius.md');
  });
}

if (require.main === module) {
  runUnitDesignTokensTests();
  console.log('\n✅ unit-design-tokens: all passed\n');
}
